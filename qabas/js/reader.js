(function () {
  "use strict";

  let _containerEl = null;
  let _bookmarksEl = null;
  let _tocEl = null;
  let _initialized = false;
  let _observer = null;
  let _scrollBound = false;

  const ui = {
    docId: null,
    inlineFilter: "",
    showDiffs: false,
    showHidden: false,
    editingParaId: null,
    editingNoteParaId: null,
    insertingAfterParaId: null,
    editingInsId: null,
    lastClickedParaId: null,
    bookmarkFilter: "all",
  };

  const HL_META = {
    principle: { cls: "hl-principle", label: "قاعدة تأصيلية" },
    evidence: { cls: "hl-evidence", label: "شاهد وحديث" },
    story: { cls: "hl-story", label: "قصة ومثال" },
    action: { cls: "hl-action", label: "وظيفة عملية" },
  };

  function getDocOrderedParaIds(doc) {
    const ids = [];
    if (!doc) return ids;
    if (doc.kind === "topic") {
      (doc.chapters || []).forEach((ch) => {
        (ch.subtopics || []).forEach((sub) => {
          (sub.paragraphs || []).forEach((p) => ids.push(p.id));
        });
      });
    } else {
      (doc.sections || []).forEach((sec) => {
        (sec.paragraphs || []).forEach((p) => ids.push(p.id));
      });
    }
    return ids;
  }

  function renderSplitSourceBar(currentDoc) {
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const allowedLessons = S.lessons.filter((l) => S.isDocQualityAllowed(l) || l.id === currentDoc.id);
    const optionsHtml = [
      `<optgroup label="الكتب الموضوعية (${S.topics.length})">`,
      ...S.topics.map(
        (t) =>
          `<option value="${t.id}" ${t.id === currentDoc.id ? "selected" : ""}>كتاب ${t.num}: ${U.escapeHtml(t.title)}</option>`
      ),
      `</optgroup>`,
      `<optgroup label="المجالس المستقلة (${allowedLessons.length})">`,
      ...allowedLessons.map(
        (l) =>
          `<option value="${l.id}" ${l.id === currentDoc.id ? "selected" : ""}>${U.escapeHtml(l.title)}</option>`
      ),
      `</optgroup>`,
    ].join("");

    return `
      <div class="split-source-bar">
        <span style="font-size:12.5px; font-weight:700; color:var(--accent); white-space:nowrap;">المصدر:</span>
        <select class="select-input" data-reader-switch-doc="1" style="flex:1; min-width:180px;">
          ${optionsHtml}
        </select>
        <button class="btn btn-sm btn-ghost" data-reader-open-search="1" title="بحث شامل في كل الكتب">بحث شامل</button>
      </div>`;
  }

  function renderParagraphCard(doc, p, filterQuery) {
    const S = window.QabasStore;
    const U = window.QabasUtils;
    if (!S.isParagraphQualityAllowed(p)) {
      return "";
    }
    const ann = S.state.annotations[p.id] || {};
    const isHidden = !!ann.hidden;
    if (isHidden && !ui.showHidden) {
      return "";
    }

    const effText = S.getEffectiveParagraphText(p.id);
    if (filterQuery) {
      const normP = U.normalizeForSearch(effText + " " + (ann.note || ""));
      const tokens = U.normalizeForSearch(filterQuery).split(/\s+/).filter(Boolean);
      if (!tokens.every((tk) => normP.includes(tk))) {
        return "";
      }
    }

    const isEdited = typeof ann.editedText === "string" && ann.editedText !== p.text;
    const isBookmarked = !!ann.bookmarked;
    const isSelected = S.isSelected(p.id);
    const hlKey = ann.highlight || "";
    const hlClass = HL_META[hlKey] ? HL_META[hlKey].cls : "";
    const multiSelect = !!S.state.prefs.multiSelect;
    const wc = U.countWords(effText);

    const cardClasses = [
      "para-card",
      hlClass,
      isSelected ? "is-selected" : "",
      isEdited ? "is-edited" : "",
      isBookmarked ? "is-bookmarked" : "",
      isHidden ? "is-hidden-para" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const renderedTextHtml = filterQuery
      ? U.highlightMatches(effText, filterQuery, 0)
      : U.escapeHtml(effText);

    const isEditingThis = ui.editingParaId === p.id;
    const isEditingNote = ui.editingNoteParaId === p.id;
    const isInsertingAfter = ui.insertingAfterParaId === p.id;

    let diffBlockHtml = "";
    if (ui.showDiffs && isEdited && !isEditingThis) {
      diffBlockHtml = `
        <div class="para-diff-view">
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px; font-weight:600;">مقارنة التعديل بالنص الأصلي للحبيب علي الجفري:</div>
          ${U.computeWordDiffHtml(p.text, effText)}
        </div>`;
    }

    let editorHtml = "";
    if (isEditingThis) {
      editorHtml = `
        <div class="para-inline-editor" data-editor-for="${p.id}">
          <textarea class="editor-textarea" id="inlineTextarea_${p.id}">${U.escapeHtml(effText)}</textarea>
          <div class="editor-toolbar">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-sm btn-primary" data-save-para="${p.id}">حفظ التعديل</button>
              <button class="btn btn-sm btn-ghost" data-split-para="${p.id}" title="ضع المؤشر في الموضع المطلوب ثم اضغط لتقسيم الفقرة إلى فقرتين">✂ تقسيم عند المؤشر</button>
              <button class="btn btn-sm btn-ghost" data-clean-para="${p.id}" title="تطهير المسافات وتوحيد الأرقام">ضبط المسافات</button>
              <button class="btn btn-sm btn-ghost" data-strip-tashkeel-para="${p.id}">إزالة التشكيل</button>
              ${
                isEdited
                  ? `<button class="btn btn-sm btn-danger" data-revert-para="${p.id}">استعادة الأصل</button>`
                  : ""
              }
            </div>
            <button class="btn btn-sm btn-ghost" data-cancel-edit="${p.id}">إغلاق</button>
          </div>
        </div>`;
    }

    let noteHtml = "";
    if (isEditingNote) {
      noteHtml = `
        <div class="para-inline-editor" style="margin-top:4px;">
          <textarea class="editor-textarea" id="noteTextarea_${p.id}" style="min-height:76px; font-size:14.5px;" placeholder="اكتب حاشية علمية أو ملاحظة إنتاجية خاصة بهذه الفقرة...">${U.escapeHtml(ann.note || "")}</textarea>
          <div class="editor-toolbar">
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-primary" data-save-note="${p.id}">حفظ الحاشية</button>
              ${
                ann.note
                  ? `<button class="btn btn-sm btn-danger" data-delete-note="${p.id}">حذف الحاشية</button>`
                  : ""
              }
            </div>
            <button class="btn btn-sm btn-ghost" data-cancel-note="${p.id}">إغلاق</button>
          </div>
        </div>`;
    } else if (ann.note) {
      noteHtml = `
        <div class="para-note-box">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:12.5px;">حاشية خاصة:</strong>
            <button class="act-btn" data-open-note="${p.id}">تعديل الحاشية</button>
          </div>
          <div>${U.escapeHtml(ann.note)}</div>
        </div>`;
    }

    let insertAfterFormHtml = "";
    if (isInsertingAfter) {
      insertAfterFormHtml = `
        <div class="para-inline-editor" style="margin-top:6px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <strong style="font-size:13px;">إدراج كتلة جديدة أسفل هذه الفقرة:</strong>
            <select id="insType_${p.id}" class="select-input" style="height:28px; font-size:12.5px;">
              <option value="p">فقرة متنية إضافية</option>
              <option value="h3">عنوان فرعي جديد</option>
              <option value="note">ملاحظة / توجيه</option>
            </select>
          </div>
          <textarea class="editor-textarea" id="insTextarea_${p.id}" style="min-height:84px;" placeholder="اكتب النص المراد إدراجه هنا..."></textarea>
          <div class="editor-toolbar">
            <button class="btn btn-sm btn-primary" data-confirm-insert="${p.id}">إدراج وحفظ</button>
            <button class="btn btn-sm btn-ghost" data-cancel-insert="${p.id}">إلغاء</button>
          </div>
        </div>`;
    }

    // Render any user-inserted blocks attached after this paragraph
    const docInsertions = (S.state.docInsertions[doc.id] || []).filter(
      (ins) => ins.afterParaId === p.id
    );
    const insertionsHtml = docInsertions
      .map((ins) => {
        if (ui.editingInsId === ins.id) {
          return `
            <div class="para-card inserted-card" id="${ins.id}">
              <div class="para-body">
                <div class="para-inline-editor">
                  <textarea class="editor-textarea" id="editInsTextarea_${ins.id}" style="min-height:84px;">${U.escapeHtml(ins.text)}</textarea>
                  <div class="editor-toolbar">
                    <button class="btn btn-sm btn-primary" data-save-ins="${ins.id}" data-doc-id="${doc.id}">حفظ</button>
                    <button class="btn btn-sm btn-ghost" data-cancel-ins="1">إلغاء</button>
                  </div>
                </div>
              </div>
            </div>`;
        }
        return `
          <article class="para-card inserted-card hl-principle" id="${ins.id}">
            <div class="para-body">
              <div style="font-size:12px; color:var(--accent); font-weight:700;">
                ${ins.type === "h3" ? "عنوان مضاف" : ins.type === "note" ? "ملاحظة مضافة" : "فقرة مضافة"}
              </div>
              <p class="para-text" style="${ins.type === "h3" ? "font-weight:700; color:var(--teal);" : ""}">${U.escapeHtml(ins.text)}</p>
              <div class="para-footer">
                <span class="stat-chip">${U.formatNum(U.countWords(ins.text))} كلمة</span>
                <div class="para-actions" style="opacity:1;">
                  <button class="act-btn" data-copy-raw="${U.escapeHtml(ins.text)}">نسخ</button>
                  <button class="act-btn" data-edit-ins="${ins.id}">تعديل</button>
                  <button class="act-btn" data-delete-ins="${ins.id}" data-doc-id="${doc.id}">حذف ×</button>
                </div>
              </div>
            </div>
          </article>`;
      })
      .join("");

    return `
      <article class="${cardClasses}" id="${p.id}" data-para-id="${p.id}">
        ${
          multiSelect || isSelected
            ? `<div class="para-select-col">
                <input type="checkbox" class="para-checkbox" data-check-para="${p.id}" ${isSelected ? "checked" : ""} title="تحديد الفقرة (يدعم Shift+Click لتحديد نطاق)" />
              </div>`
            : ""
        }
        <div class="para-body">
          ${!isEditingThis ? `<p class="para-text">${renderedTextHtml}</p>` : ""}
          ${diffBlockHtml}
          ${editorHtml}
          ${noteHtml}
          ${insertAfterFormHtml}
          <div class="para-footer">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="stat-chip" style="padding:2px 8px; font-size:12px;">${U.formatNum(wc)} كلمة</span>
              ${isEdited ? `<span class="stat-chip" style="padding:2px 8px; font-size:12px; color:var(--teal);">معدّلة</span>` : ""}
              ${!isEdited && p.qTier === "low" ? `<span class="stat-chip" style="padding:2px 8px; font-size:12px; color:var(--rose);">تفريغ خام</span>` : ""}
              ${hlKey && HL_META[hlKey] ? `<span class="stat-chip" style="padding:2px 8px; font-size:12px;">${HL_META[hlKey].label}</span>` : ""}
            </div>
            <div class="para-actions">
              <button class="act-btn act-btn-accent" data-copy-para="${p.id}" title="نسخ الفقرة فوراً">نسخ</button>
              <button class="act-btn" data-copy-cited="${p.id}" title="نسخ الفقرة مع العنوان والمصدر">مع العزو</button>
              <button class="act-btn act-btn-emerald" data-send-custom="${p.id}" title="إضافة هذه الفقرة مباشرة إلى النسخة المخصصة">+ للنسخة</button>
              <button class="act-btn" data-edit-para="${p.id}" title="تعديل نص الفقرة أو تقسيمها">تعديل</button>
              <button class="act-btn" data-open-note="${p.id}" title="إضافة أو تحرير حاشية خاصة">${ann.note ? "حاشية ✓" : "حاشية"}</button>
              <button class="act-btn" data-insert-after="${p.id}" title="إدراج فقرة أو عنوان أسفل هذه الفقرة">+ إدراج</button>
              <button class="act-btn ${isBookmarked ? "act-btn-accent" : ""}" data-bookmark-para="${p.id}" title="حفظ في المفضلة">${isBookmarked ? "★ مفضلة" : "☆ مفضلة"}</button>
              <select class="act-btn" data-hl-select="${p.id}" title="تصنيف وتمييز لوني للفقرة" style="padding:0 6px; cursor:pointer;">
                <option value="" ${!hlKey ? "selected" : ""}>تمييز...</option>
                <option value="principle" ${hlKey === "principle" ? "selected" : ""}>تأصيل</option>
                <option value="evidence" ${hlKey === "evidence" ? "selected" : ""}>شاهد</option>
                <option value="story" ${hlKey === "story" ? "selected" : ""}>قصة ومثال</option>
                <option value="action" ${hlKey === "action" ? "selected" : ""}>وظيفة عملية</option>
              </select>
              <button class="act-btn" data-toggle-hide-para="${p.id}" title="${isHidden ? "إظهار الفقرة" : "إخفاء الفقرة من العرض والتصدير"}">${isHidden ? "إظهار" : "إخفاء"}</button>
            </div>
          </div>
        </div>
      </article>
      ${insertionsHtml}`;
  }

  function renderDoc(docId) {
    if (!_containerEl) return;
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const doc = S.getDoc(docId || S.state.prefs.activeDocId || "T01");
    if (!doc) {
      _containerEl.innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-muted);">لم يُعثر على الدرس المطلوب.</div>`;
      return;
    }

    if (ui.docId !== doc.id) {
      ui.docId = doc.id;
      ui.inlineFilter = "";
      ui.editingParaId = null;
      ui.editingNoteParaId = null;
      ui.insertingAfterParaId = null;
      ui.editingInsId = null;
    }

    const isRead = !!S.state.readDocs[doc.id];
    const editCount = S.getDocEditCount(doc.id);
    const multiSelect = !!S.state.prefs.multiSelect;
    const hiddenCount = getDocOrderedParaIds(doc).filter(
      (pid) => S.state.annotations[pid] && S.state.annotations[pid].hidden
    ).length;

    let bodySectionsHtml = "";
    const fq = ui.inlineFilter.trim();

    if (doc.kind === "topic") {
      bodySectionsHtml = (doc.chapters || [])
        .map((ch) => {
          const subHtml = (ch.subtopics || [])
            .map((sub) => {
              const parasHtml = (sub.paragraphs || [])
                .map((p) => renderParagraphCard(doc, p, fq))
                .filter(Boolean)
                .join("");
              if (!parasHtml) return "";
              return `
                <section class="subtopic-block" id="${sub.id}" data-toc-target="${sub.id}">
                  <div class="subtopic-header">
                    <h3 class="subtopic-title">${fq ? U.highlightMatches(sub.title, fq, 0) : U.escapeHtml(sub.title)}</h3>
                    <div class="section-actions">
                      <button class="btn btn-sm btn-ghost" data-copy-section="${sub.id}" data-doc-id="${doc.id}">نسخ المبحث</button>
                      <button class="btn btn-sm btn-emerald" data-send-section-custom="${sub.id}" data-doc-id="${doc.id}">+ المبحث للنسخة</button>
                      <button class="btn btn-sm btn-ghost" data-fork-section="${sub.id}" data-doc-id="${doc.id}">نسخة مخصصة</button>
                    </div>
                  </div>
                  ${parasHtml}
                </section>`;
            })
            .filter(Boolean)
            .join("");

          if (!subHtml) return "";
          return `
            <section class="chapter-block" id="${ch.id}" data-toc-target="${ch.id}">
              <div class="chapter-header">
                <h2 class="chapter-title">${fq ? U.highlightMatches(ch.title, fq, 0) : U.escapeHtml(ch.title)}</h2>
                <div class="section-actions">
                  <span class="stat-chip">${U.formatNum(ch.wordCount)} كلمة</span>
                  <button class="btn btn-sm btn-ghost" data-fork-section="${ch.id}" data-doc-id="${doc.id}">إنشاء نسخة من الباب</button>
                </div>
              </div>
              ${subHtml}
            </section>`;
        })
        .filter(Boolean)
        .join("");
    } else {
      bodySectionsHtml = (doc.sections || [])
        .map((sec) => {
          const parasHtml = (sec.paragraphs || [])
            .map((p) => renderParagraphCard(doc, p, fq))
            .filter(Boolean)
            .join("");
          if (!parasHtml) return "";
          return `
            <section class="chapter-block" id="${sec.id}" data-toc-target="${sec.id}">
              <div class="chapter-header">
                <h2 class="chapter-title">${fq ? U.highlightMatches(sec.title, fq, 0) : U.escapeHtml(sec.title)}</h2>
                <div class="section-actions">
                  <button class="btn btn-sm btn-ghost" data-copy-section="${sec.id}" data-doc-id="${doc.id}">نسخ المحور</button>
                  <button class="btn btn-sm btn-emerald" data-send-section-custom="${sec.id}" data-doc-id="${doc.id}">+ المحور للنسخة</button>
                  <button class="btn btn-sm btn-ghost" data-fork-section="${sec.id}" data-doc-id="${doc.id}">نسخة مخصصة</button>
                </div>
              </div>
              ${parasHtml}
            </section>`;
        })
        .filter(Boolean)
        .join("");
    }

    if (!bodySectionsHtml) {
      bodySectionsHtml = fq
        ? `<div style="padding:36px; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:8px;">لا توجد فقرات مطابقة للتصفية «${U.escapeHtml(fq)}» داخل هذا الدرس.</div>`
        : `<div style="padding:36px; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:8px;">جميع فقرات هذا المجلس مصنفة كتفريغ خام وقد استُبعدت بفلتر الجودة النشط.</div>`;
    }

    const visStats = S.getDocVisibleStats(doc);
    const kickerLabel =
      doc.kind === "topic"
        ? `الكتاب الموضوعي ${doc.num} من 12`
        : `المجلس التسلسلي ${doc.num}`;

    _containerEl.innerHTML = `
      ${S.state.prefs.splitMode ? renderSplitSourceBar(doc) : ""}
      <div class="reader-column" style="max-width: var(--reader-max-width, 820px); margin: 0 auto;">
        <header class="doc-hero">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span class="doc-kicker">${kickerLabel}</span>
            <button class="btn btn-sm ${isRead ? "btn-emerald" : "btn-ghost"}" data-toggle-read="${doc.id}">
              ${isRead ? "✓ تمت قراءته" : "تعليم كمقروء"}
            </button>
          </div>
          <h1 class="doc-h1">${U.escapeHtml(doc.title)}</h1>
          <div class="doc-stats-row">
            ${doc.kind === "topic" ? `<span class="stat-chip">${U.formatNum(doc.chapterCount)} أبواب رئيسية</span>` : ""}
            <span class="stat-chip">${U.formatNum(doc.sectionCount)} ${doc.kind === "topic" ? "مبحثاً فرعياً" : "محوراً"}</span>
            <span class="stat-chip">${U.formatNum(visStats.paragraphs)} فقرة صافية</span>
            <span class="stat-chip">${U.formatNum(visStats.words)} كلمة</span>
            <span class="stat-chip">زمن القراءة والإلقاء: ${U.formatDuration(visStats.words, S.state.prefs.wpm)}</span>
            ${
              visStats.filteredOutCount > 0
                ? `<span class="stat-chip" style="color:var(--emerald); border-color:var(--emerald-border);">✓ استُبعدت ${U.formatNum(visStats.filteredOutCount)} فقرة رديئة</span>`
                : ""
            }
            ${
              editCount > 0
                ? `<span class="stat-chip" style="color:var(--teal); border-color:var(--teal);">${U.formatNum(editCount)} تعديل محلي</span>`
                : ""
            }
          </div>
          <div class="doc-toolbar">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-pill btn-primary" data-open-fork="${doc.id}">+ إنشاء نسخة مخصصة من الدرس</button>
              <button class="btn btn-pill btn-ghost" data-copy-full-doc="${doc.id}">نسخ الدرس كاملاً</button>
              <button class="btn btn-pill btn-ghost" data-download-doc="${doc.id}">تنزيل .md</button>
              <button class="btn btn-pill btn-ghost ${multiSelect ? "is-active" : ""}" data-toggle-multiselect="1">
                ${multiSelect ? "✓ التحديد المتعدد مفعّل" : "تحديد متعدد للفقرات"}
              </button>
              <button class="btn btn-pill btn-ghost" data-teleprompter-doc="${doc.id}">وضع الإلقاء</button>
              ${
                editCount > 0
                  ? `
                    <button class="btn btn-pill btn-ghost ${ui.showDiffs ? "is-active" : ""}" data-toggle-doc-diffs="1">
                      ${ui.showDiffs ? "إخفاء الفروق" : "عرض الفروق مع الأصل"}
                    </button>
                    <button class="btn btn-pill btn-danger" data-revert-all-doc="${doc.id}">استعادة أصل الدرس</button>
                  `
                  : ""
              }
              ${
                hiddenCount > 0
                  ? `<button class="btn btn-pill btn-ghost ${ui.showHidden ? "is-active" : ""}" data-toggle-show-hidden="1">
                      ${ui.showHidden ? "إخفاء المستبعدة" : `إظهار المستبعدة (${hiddenCount})`}
                    </button>`
                  : ""
              }
            </div>
            <input type="search" class="inline-filter-input" id="docInlineFilterInput" value="${U.escapeHtml(ui.inlineFilter)}" placeholder="تصفية الفقرات داخل هذا الدرس..." autocomplete="off" />
          </div>
        </header>

        <div class="doc-body-content">
          ${bodySectionsHtml}
        </div>
      </div>`;

    renderToc(doc);
    setupScrollSpy();
  }

  function renderToc(doc) {
    if (!_tocEl) return;
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const statsBadge = document.getElementById("tocStatsBadge");

    if (doc.kind === "topic") {
      let visChCount = 0;
      let visSubCount = 0;
      const html = (doc.chapters || [])
        .map((ch) => {
          const visSubs = (ch.subtopics || []).filter((sub) =>
            (sub.paragraphs || []).some((p) => S.isParagraphQualityAllowed(p))
          );
          if (!visSubs.length) return "";
          visChCount++;
          visSubCount += visSubs.length;
          return `
            <button class="toc-chapter" data-toc-jump="${ch.id}">${U.escapeHtml(ch.title)}</button>
            ${visSubs
              .map(
                (sub) =>
                  `<button class="toc-item" data-toc-jump="${sub.id}">${U.escapeHtml(sub.title)}</button>`
              )
              .join("")}
          `;
        })
        .filter(Boolean)
        .join("");
      _tocEl.innerHTML = html;
      if (statsBadge) statsBadge.textContent = `${visChCount} أبواب · ${visSubCount} مبحثاً`;
    } else {
      const visSecs = (doc.sections || []).filter((sec) =>
        (sec.paragraphs || []).some((p) => S.isParagraphQualityAllowed(p))
      );
      _tocEl.innerHTML = visSecs
        .map(
          (sec, idx) =>
            `<button class="toc-item" data-toc-jump="${sec.id}">${idx + 1}. ${U.escapeHtml(sec.title)}</button>`
        )
        .join("");
      if (statsBadge) statsBadge.textContent = `${visSecs.length} محاور`;
    }
  }

  function setupScrollSpy() {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    if (!_containerEl || !_tocEl || typeof IntersectionObserver === "undefined") return;

    const targets = _containerEl.querySelectorAll("[data-toc-target]");
    if (!targets.length) return;

    _observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((en) => en.isIntersecting);
        if (!visible.length) return;
        const topTargetId = visible[0].target.getAttribute("data-toc-target");
        if (!topTargetId || !_tocEl) return;
        _tocEl.querySelectorAll("[data-toc-jump]").forEach((btn) => {
          btn.classList.toggle("is-active", btn.getAttribute("data-toc-jump") === topTargetId);
        });
      },
      { rootMargin: "-70px 0px -65% 0px", threshold: 0.01 }
    );

    targets.forEach((t) => _observer.observe(t));

    if (!_scrollBound) {
      _scrollBound = true;
      const updateProgress = () => {
        const fill = document.getElementById("readingProgressFill");
        if (!fill) return;
        const pane = window.QabasStore.state.prefs.splitMode ? _containerEl : document.documentElement;
        const scrollTop = window.QabasStore.state.prefs.splitMode
          ? _containerEl.scrollTop
          : window.scrollY || document.documentElement.scrollTop;
        const maxScroll = Math.max(1, pane.scrollHeight - pane.clientHeight);
        const pct = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
        fill.style.width = `${pct.toFixed(1)}%`;
      };
      window.addEventListener("scroll", updateProgress, { passive: true });
      _containerEl.addEventListener("scroll", updateProgress, { passive: true });
    }
  }

  function scrollToTarget(targetId) {
    if (!targetId) return;
    const node = document.getElementById(targetId);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.remove("is-flash-target");
    void node.offsetWidth;
    node.classList.add("is-flash-target");
  }

  // ==================== Bookmarks & Annotations Hub ====================
  function renderBookmarks(filterHighlight = null) {
    if (!_bookmarksEl) return;
    if (filterHighlight !== null) {
      ui.bookmarkFilter = filterHighlight;
    }
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const allItems = S.getAllBookmarkedAndAnnotated("all");

    const filtered = allItems.filter((item) => {
      const f = ui.bookmarkFilter;
      if (f === "all") return true;
      if (f === "bookmarked") return !!item.bookmarked;
      if (f === "edited") return !!item.isEdited;
      if (f === "notes") return !!(item.note && item.note.trim());
      return item.highlight === f;
    });

    const filters = [
      { id: "all", label: `الكل (${U.formatNum(allItems.length)})` },
      { id: "bookmarked", label: "المفضلة ★" },
      { id: "principle", label: "قواعد تأصيلية" },
      { id: "evidence", label: "شواهد وأحاديث" },
      { id: "story", label: "قصص وأمثلة" },
      { id: "action", label: "وظائف عملية" },
      { id: "notes", label: "الحواشي الخاصة" },
      { id: "edited", label: "الفقرات المعدّلة" },
    ];

    _bookmarksEl.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
        <header class="doc-hero">
          <span class="doc-kicker">حقيبة الفوائد والحواشي والتعديلات</span>
          <h1 class="doc-h1">الفقرات المميزة والمفضلة والحواشي الخاصة</h1>
          <div class="doc-toolbar" style="justify-content:space-between;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${filters
                .map(
                  (f) =>
                    `<button class="btn btn-sm btn-pill ${ui.bookmarkFilter === f.id ? "btn-primary" : "btn-ghost"}" data-bm-filter="${f.id}">${f.label}</button>`
                )
                .join("")}
            </div>
            ${
              filtered.length
                ? `<div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-pill btn-emerald" data-bm-create-custom="1">+ إنشاء نسخة مخصصة من المعروض (${U.formatNum(filtered.length)})</button>
                    <button class="btn btn-sm btn-pill btn-ghost" data-bm-copy-all="1">نسخ الكل</button>
                  </div>`
                : ""
            }
          </div>
        </header>

        ${
          !filtered.length
            ? `<div style="padding:42px; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:8px;">
                لا توجد فقرات محفوظة ضمن هذا التصنيف بعد. يمكنك أثناء القراءة الضغط على «☆ مفضلة» أو «تمييز...» أو «حاشية» لتجتمع فوائدك هنا تلقائياً.
              </div>`
            : filtered
                .map((it) => {
                  const hlCls = HL_META[it.highlight] ? HL_META[it.highlight].cls : "";
                  return `
                    <article class="para-card ${hlCls}" style="margin-bottom:14px;">
                      <div class="para-body">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:12.5px; color:var(--text-muted);">
                          <div>
                            <strong style="color:var(--accent);">${U.escapeHtml(it.docTitle || "")}</strong>
                            ${it.sectionTitle ? ` · <span>${U.escapeHtml(it.sectionTitle)}</span>` : ""}
                          </div>
                          <div style="display:flex; gap:6px;">
                            ${it.bookmarked ? `<span class="stat-chip">★ مفضلة</span>` : ""}
                            ${it.highlight && HL_META[it.highlight] ? `<span class="stat-chip">${HL_META[it.highlight].label}</span>` : ""}
                            ${it.isEdited ? `<span class="stat-chip" style="color:var(--teal);">معدّلة</span>` : ""}
                          </div>
                        </div>
                        <p class="para-text">${U.escapeHtml(it.text)}</p>
                        ${
                          it.note
                            ? `<div class="para-note-box"><strong>حاشية:</strong> <div>${U.escapeHtml(it.note)}</div></div>`
                            : ""
                        }
                        <div class="para-footer">
                          <span class="stat-chip">${U.formatNum(U.countWords(it.text))} كلمة</span>
                          <div class="para-actions" style="opacity:1;">
                            <button class="act-btn act-btn-accent" data-bm-jump-doc="${it.docId}" data-bm-jump-para="${it.paraId}">الانتقال للموضع</button>
                            <button class="act-btn" data-bm-copy-one="${it.paraId}">نسخ</button>
                            <button class="act-btn act-btn-emerald" data-bm-send-custom="${it.paraId}">+ للنسخة المخصصة</button>
                          </div>
                        </div>
                      </div>
                    </article>`;
                })
                .join("")
        }
      </div>`;
  }

  function copySectionParagraphs(docId, sectionId) {
    const S = window.QabasStore;
    const doc = S.getDoc(docId);
    if (!doc) return "";
    if (doc.kind === "topic") {
      for (const ch of doc.chapters || []) {
        for (const sub of ch.subtopics || []) {
          if (sub.id === sectionId) {
            const body = sub.paragraphs
              .filter((p) => S.isParagraphQualityAllowed(p) && !(S.state.annotations[p.id] && S.state.annotations[p.id].hidden))
              .map((p) => S.getEffectiveParagraphText(p.id))
              .join("\n\n");
            return `### ${sub.title}\n\n${body}`;
          }
        }
      }
    } else {
      for (const sec of doc.sections || []) {
        if (sec.id === sectionId) {
          const body = sec.paragraphs
            .filter((p) => S.isParagraphQualityAllowed(p) && !(S.state.annotations[p.id] && S.state.annotations[p.id].hidden))
            .map((p) => S.getEffectiveParagraphText(p.id))
            .join("\n\n");
          return `## ${sec.title}\n\n${body}`;
        }
      }
    }
    return "";
  }

  function init(containerEl, bookmarksEl, tocEl) {
    _containerEl = containerEl;
    _bookmarksEl = bookmarksEl;
    _tocEl = tocEl;
    if (_initialized) return;
    _initialized = true;

    // Reader Delegated Clicks
    _containerEl?.addEventListener("click", async (e) => {
      const S = window.QabasStore;
      const U = window.QabasUtils;
      const A = window.QabasApp;

      // Checkbox range or single toggle
      const checkEl = e.target.closest("[data-check-para]");
      if (checkEl) {
        const pid = checkEl.getAttribute("data-check-para");
        const doc = S.getDoc(ui.docId);
        if (e.shiftKey && ui.lastClickedParaId && doc) {
          const ordered = getDocOrderedParaIds(doc);
          const i1 = ordered.indexOf(ui.lastClickedParaId);
          const i2 = ordered.indexOf(pid);
          if (i1 !== -1 && i2 !== -1) {
            const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
            S.selectRange(ordered.slice(lo, hi + 1), checkEl.checked);
          } else {
            S.toggleSelect(pid);
          }
        } else {
          S.toggleSelect(pid);
        }
        ui.lastClickedParaId = pid;
        return;
      }

      if (e.target.closest("[data-reader-open-search]")) {
        A.openSearchModal();
        return;
      }

      const toggleReadBtn = e.target.closest("[data-toggle-read]");
      if (toggleReadBtn) {
        const did = toggleReadBtn.getAttribute("data-toggle-read");
        S.toggleReadDoc(did);
        renderDoc(did);
        return;
      }

      const openForkBtn = e.target.closest("[data-open-fork]");
      if (openForkBtn) {
        A.openForkModal(openForkBtn.getAttribute("data-open-fork"), null);
        return;
      }

      const copyFullDocBtn = e.target.closest("[data-copy-full-doc]");
      if (copyFullDocBtn) {
        const did = copyFullDocBtn.getAttribute("data-copy-full-doc");
        const txt = S.exportDocText(did, S.state.prefs.copyFormat === "markdown" ? "markdown" : "plain");
        await U.copyText(txt);
        A.toast("تم نسخ الدرس كاملاً إلى الحافظة");
        return;
      }

      const dlDocBtn = e.target.closest("[data-download-doc]");
      if (dlDocBtn) {
        const did = dlDocBtn.getAttribute("data-download-doc");
        const doc = S.getDoc(did);
        const md = S.exportDocText(did, "markdown");
        U.downloadTextFile(doc ? doc.fileName : `${did}.md`, md);
        A.toast("تم تنزيل ملف الدرس بصيغة Markdown");
        return;
      }

      if (e.target.closest("[data-toggle-multiselect]")) {
        S.updatePrefs({ multiSelect: !S.state.prefs.multiSelect });
        renderDoc(ui.docId);
        return;
      }

      const tpBtn = e.target.closest("[data-teleprompter-doc]");
      if (tpBtn) {
        A.openTeleprompter({ docId: tpBtn.getAttribute("data-teleprompter-doc") });
        return;
      }

      if (e.target.closest("[data-toggle-doc-diffs]")) {
        ui.showDiffs = !ui.showDiffs;
        renderDoc(ui.docId);
        return;
      }

      const revAllBtn = e.target.closest("[data-revert-all-doc]");
      if (revAllBtn) {
        const did = revAllBtn.getAttribute("data-revert-all-doc");
        S.revertAllInDoc(did);
        renderDoc(did);
        A.toast("تمت استعادة النص الأصلي الكامل للدرس");
        return;
      }

      if (e.target.closest("[data-toggle-show-hidden]")) {
        ui.showHidden = !ui.showHidden;
        renderDoc(ui.docId);
        return;
      }

      // Section-level actions
      const copySecBtn = e.target.closest("[data-copy-section]");
      if (copySecBtn) {
        const txt = copySectionParagraphs(
          copySecBtn.getAttribute("data-doc-id"),
          copySecBtn.getAttribute("data-copy-section")
        );
        await U.copyText(txt);
        A.toast("تم نسخ المبحث كاملاً إلى الحافظة");
        return;
      }

      const sendSecBtn = e.target.closest("[data-send-section-custom]");
      if (sendSecBtn) {
        const cl = S.appendSectionToCustom(
          sendSecBtn.getAttribute("data-doc-id"),
          sendSecBtn.getAttribute("data-send-section-custom")
        );
        if (cl) {
          if (S.state.prefs.splitMode) window.QabasStudio.render(cl.id);
          A.toast(`أُضيف المبحث كاملاً إلى «${cl.title}»`);
        }
        return;
      }

      const forkSecBtn = e.target.closest("[data-fork-section]");
      if (forkSecBtn) {
        A.openForkModal(
          forkSecBtn.getAttribute("data-doc-id"),
          forkSecBtn.getAttribute("data-fork-section")
        );
        return;
      }

      // Paragraph-level actions
      const copyParaBtn = e.target.closest("[data-copy-para]");
      if (copyParaBtn) {
        const pid = copyParaBtn.getAttribute("data-copy-para");
        const txt = S.formatParagraphForCopy(pid);
        await U.copyText(txt);
        A.toast(`تم نسخ الفقرة (${U.formatNum(U.countWords(txt))} كلمة)`);
        return;
      }

      const copyCitedBtn = e.target.closest("[data-copy-cited]");
      if (copyCitedBtn) {
        const pid = copyCitedBtn.getAttribute("data-copy-cited");
        const txt = S.formatParagraphForCopy(pid, "citation");
        await U.copyText(txt);
        A.toast("تم نسخ الفقرة مع العنوان والعزو");
        return;
      }

      const copyRawBtn = e.target.closest("[data-copy-raw]");
      if (copyRawBtn) {
        await U.copyText(copyRawBtn.getAttribute("data-copy-raw"));
        A.toast("تم النسخ إلى الحافظة");
        return;
      }

      const sendParaBtn = e.target.closest("[data-send-custom]");
      if (sendParaBtn) {
        const pid = sendParaBtn.getAttribute("data-send-custom");
        const cl = S.appendParagraphToCustom(pid);
        if (cl) {
          if (S.state.prefs.splitMode) window.QabasStudio.render(cl.id);
          A.toast(`أُضيفت الفقرة إلى «${cl.title}»`);
        }
        return;
      }

      const editParaBtn = e.target.closest("[data-edit-para]");
      if (editParaBtn) {
        const pid = editParaBtn.getAttribute("data-edit-para");
        ui.editingParaId = ui.editingParaId === pid ? null : pid;
        renderDoc(ui.docId);
        if (ui.editingParaId) {
          const ta = document.getElementById(`inlineTextarea_${pid}`);
          ta?.focus();
        }
        return;
      }

      if (e.target.closest("[data-cancel-edit]")) {
        ui.editingParaId = null;
        renderDoc(ui.docId);
        return;
      }

      const saveParaBtn = e.target.closest("[data-save-para]");
      if (saveParaBtn) {
        const pid = saveParaBtn.getAttribute("data-save-para");
        const ta = document.getElementById(`inlineTextarea_${pid}`);
        if (ta) {
          const cleaned = U.cleanTextRules(ta.value, { escapeAngles: true });
          S.saveParagraphAnnotation(pid, { editedText: cleaned });
          ui.editingParaId = null;
          renderDoc(ui.docId);
          A.toast("حُفظ تعديل الفقرة بنجاح");
        }
        return;
      }

      const splitParaBtn = e.target.closest("[data-split-para]");
      if (splitParaBtn) {
        const pid = splitParaBtn.getAttribute("data-split-para");
        const ta = document.getElementById(`inlineTextarea_${pid}`);
        if (ta) {
          const pos = ta.selectionStart || 0;
          const before = ta.value.slice(0, pos).trim();
          const after = ta.value.slice(pos).trim();
          if (!before || !after) {
            A.toast("ضع المؤشر في وسط النص لتقسيم الفقرة إلى شطرين", "info");
            return;
          }
          S.splitDocParagraph(ui.docId, pid, before, after);
          ui.editingParaId = null;
          renderDoc(ui.docId);
          A.toast("تم تقسيم الفقرة إلى فقرتين بنجاح");
        }
        return;
      }

      const cleanParaBtn = e.target.closest("[data-clean-para]");
      if (cleanParaBtn) {
        const pid = cleanParaBtn.getAttribute("data-clean-para");
        const ta = document.getElementById(`inlineTextarea_${pid}`);
        if (ta) {
          ta.value = U.cleanTextRules(ta.value, { escapeAngles: true });
          A.toast("تم ضبط المسافات والأرقام المشرقية", "info");
        }
        return;
      }

      const stripTashkeelBtn = e.target.closest("[data-strip-tashkeel-para]");
      if (stripTashkeelBtn) {
        const pid = stripTashkeelBtn.getAttribute("data-strip-tashkeel-para");
        const ta = document.getElementById(`inlineTextarea_${pid}`);
        if (ta) {
          ta.value = U.cleanTextRules(ta.value, { stripTashkeel: true, escapeAngles: true });
          A.toast("أُزيل التشكيل من الفقرة", "info");
        }
        return;
      }

      const revertParaBtn = e.target.closest("[data-revert-para]");
      if (revertParaBtn) {
        const pid = revertParaBtn.getAttribute("data-revert-para");
        S.revertParagraph(pid);
        ui.editingParaId = null;
        renderDoc(ui.docId);
        A.toast("تمت استعادة النص الأصلي للفقرة");
        return;
      }

      const openNoteBtn = e.target.closest("[data-open-note]");
      if (openNoteBtn) {
        const pid = openNoteBtn.getAttribute("data-open-note");
        ui.editingNoteParaId = ui.editingNoteParaId === pid ? null : pid;
        renderDoc(ui.docId);
        document.getElementById(`noteTextarea_${pid}`)?.focus();
        return;
      }

      if (e.target.closest("[data-cancel-note]")) {
        ui.editingNoteParaId = null;
        renderDoc(ui.docId);
        return;
      }

      const saveNoteBtn = e.target.closest("[data-save-note]");
      if (saveNoteBtn) {
        const pid = saveNoteBtn.getAttribute("data-save-note");
        const ta = document.getElementById(`noteTextarea_${pid}`);
        if (ta) {
          S.saveParagraphAnnotation(pid, { note: U.cleanTextRules(ta.value) });
          ui.editingNoteParaId = null;
          renderDoc(ui.docId);
          A.toast("حُفظت الحاشية الخاصة");
        }
        return;
      }

      const delNoteBtn = e.target.closest("[data-delete-note]");
      if (delNoteBtn) {
        const pid = delNoteBtn.getAttribute("data-delete-note");
        S.saveParagraphAnnotation(pid, { note: "" });
        ui.editingNoteParaId = null;
        renderDoc(ui.docId);
        A.toast("حُذفت الحاشية");
        return;
      }

      const insAfterBtn = e.target.closest("[data-insert-after]");
      if (insAfterBtn) {
        const pid = insAfterBtn.getAttribute("data-insert-after");
        ui.insertingAfterParaId = ui.insertingAfterParaId === pid ? null : pid;
        renderDoc(ui.docId);
        document.getElementById(`insTextarea_${pid}`)?.focus();
        return;
      }

      if (e.target.closest("[data-cancel-insert]")) {
        ui.insertingAfterParaId = null;
        renderDoc(ui.docId);
        return;
      }

      const confirmInsBtn = e.target.closest("[data-confirm-insert]");
      if (confirmInsBtn) {
        const pid = confirmInsBtn.getAttribute("data-confirm-insert");
        const typeEl = document.getElementById(`insType_${pid}`);
        const ta = document.getElementById(`insTextarea_${pid}`);
        if (ta && ta.value.trim()) {
          S.addDocInsertion(
            ui.docId,
            pid,
            typeEl ? typeEl.value : "p",
            U.cleanTextRules(ta.value, { escapeAngles: true })
          );
          ui.insertingAfterParaId = null;
          renderDoc(ui.docId);
          A.toast("أُدرجت الكتلة الجديدة بنجاح");
        }
        return;
      }

      const editInsBtn = e.target.closest("[data-edit-ins]");
      if (editInsBtn) {
        ui.editingInsId = editInsBtn.getAttribute("data-edit-ins");
        renderDoc(ui.docId);
        return;
      }

      if (e.target.closest("[data-cancel-ins]")) {
        ui.editingInsId = null;
        renderDoc(ui.docId);
        return;
      }

      const saveInsBtn = e.target.closest("[data-save-ins]");
      if (saveInsBtn) {
        const insId = saveInsBtn.getAttribute("data-save-ins");
        const did = saveInsBtn.getAttribute("data-doc-id");
        const ta = document.getElementById(`editInsTextarea_${insId}`);
        if (ta && ta.value.trim()) {
          S.updateDocInsertion(did, insId, U.cleanTextRules(ta.value, { escapeAngles: true }));
          ui.editingInsId = null;
          renderDoc(did);
          A.toast("تم تحديث الكتلة المضافة");
        }
        return;
      }

      const delInsBtn = e.target.closest("[data-delete-ins]");
      if (delInsBtn) {
        const insId = delInsBtn.getAttribute("data-delete-ins");
        const did = delInsBtn.getAttribute("data-doc-id");
        S.deleteDocInsertion(did, insId);
        renderDoc(did);
        A.toast("حُذفت الكتلة المضافة");
        return;
      }

      const bmBtn = e.target.closest("[data-bookmark-para]");
      if (bmBtn) {
        const pid = bmBtn.getAttribute("data-bookmark-para");
        const cur = !!(S.state.annotations[pid] && S.state.annotations[pid].bookmarked);
        S.saveParagraphAnnotation(pid, { bookmarked: !cur });
        renderDoc(ui.docId);
        A.toast(!cur ? "أُضيفت الفقرة إلى المفضلة ★" : "أُزيلت من المفضلة", "info");
        return;
      }

      const hideBtn = e.target.closest("[data-toggle-hide-para]");
      if (hideBtn) {
        const pid = hideBtn.getAttribute("data-toggle-hide-para");
        const cur = !!(S.state.annotations[pid] && S.state.annotations[pid].hidden);
        S.saveParagraphAnnotation(pid, { hidden: !cur });
        renderDoc(ui.docId);
        A.toast(!cur ? "أُخفيت الفقرة من العرض والتصدير" : "أُعيد إظهار الفقرة", "info");
      }
    });

    // Change events (select dropdowns + inline filter)
    _containerEl?.addEventListener("change", (e) => {
      const S = window.QabasStore;
      const switchSel = e.target.closest("[data-reader-switch-doc]");
      if (switchSel) {
        window.QabasApp.navigateToDoc(switchSel.value);
        return;
      }
      const hlSel = e.target.closest("[data-hl-select]");
      if (hlSel) {
        const pid = hlSel.getAttribute("data-hl-select");
        S.saveParagraphAnnotation(pid, { highlight: hlSel.value });
        renderDoc(ui.docId);
      }
    });

    _containerEl?.addEventListener("input", (e) => {
      if (e.target && e.target.id === "docInlineFilterInput") {
        const caret = e.target.selectionStart;
        ui.inlineFilter = e.target.value;
        renderDoc(ui.docId);
        const nextInp = document.getElementById("docInlineFilterInput");
        if (nextInp) {
          nextInp.focus();
          try {
            nextInp.setSelectionRange(caret, caret);
          } catch (_) {}
        }
      }
    });

    // TOC clicks
    _tocEl?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-toc-jump]");
      if (btn) {
        scrollToTarget(btn.getAttribute("data-toc-jump"));
      }
    });

    // Bookmarks View clicks
    _bookmarksEl?.addEventListener("click", async (e) => {
      const S = window.QabasStore;
      const U = window.QabasUtils;
      const A = window.QabasApp;

      const fBtn = e.target.closest("[data-bm-filter]");
      if (fBtn) {
        renderBookmarks(fBtn.getAttribute("data-bm-filter"));
        return;
      }

      const jumpBtn = e.target.closest("[data-bm-jump-doc]");
      if (jumpBtn) {
        A.navigateToDoc(
          jumpBtn.getAttribute("data-bm-jump-doc"),
          jumpBtn.getAttribute("data-bm-jump-para")
        );
        return;
      }

      const copyOneBtn = e.target.closest("[data-bm-copy-one]");
      if (copyOneBtn) {
        const txt = S.formatParagraphForCopy(copyOneBtn.getAttribute("data-bm-copy-one"), "citation");
        await U.copyText(txt);
        A.toast("تم نسخ الفقرة مع عزوها");
        return;
      }

      const sendOneBtn = e.target.closest("[data-bm-send-custom]");
      if (sendOneBtn) {
        const cl = S.appendParagraphToCustom(sendOneBtn.getAttribute("data-bm-send-custom"));
        if (cl) A.toast(`أُضيفت إلى «${cl.title}»`);
        return;
      }

      if (e.target.closest("[data-bm-copy-all]")) {
        const items = S.getAllBookmarkedAndAnnotated("all").filter((it) => {
          const f = ui.bookmarkFilter;
          if (f === "all") return true;
          if (f === "bookmarked") return !!it.bookmarked;
          if (f === "edited") return !!it.isEdited;
          if (f === "notes") return !!(it.note && it.note.trim());
          return it.highlight === f;
        });
        const text = items.map((it) => S.formatParagraphForCopy(it.paraId, "citation")).join("\n\n");
        await U.copyText(text);
        A.toast(`تم نسخ ${items.length} فقرات إلى الحافظة`);
        return;
      }

      if (e.target.closest("[data-bm-create-custom]")) {
        const items = S.getAllBookmarkedAndAnnotated("all").filter((it) => {
          const f = ui.bookmarkFilter;
          if (f === "all") return true;
          if (f === "bookmarked") return !!it.bookmarked;
          if (f === "edited") return !!it.isEdited;
          if (f === "notes") return !!(it.note && it.note.trim());
          return it.highlight === f;
        });
        if (!items.length) return;
        const created = S.createBlankCustomLesson("نسخة مخصصة من فوائد المفضلة", "");
        items.forEach((it) => S.appendParagraphToCustom(it.paraId, created.id));
        A.openStudio(created.id);
        A.toast("أُنشئت نسخة مخصصة من الفوائد المختارة");
      }
    });
  }

  window.QabasReader = {
    init,
    renderDoc,
    renderBookmarks,
    scrollToTarget,
  };
})();

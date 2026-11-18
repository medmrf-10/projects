(function (global) {
  'use strict';

  var RE_COMBINING_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0300-\u036F]/;
  var RE_TASHKEEL_GLOBAL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  var RE_BIDI_HIDDEN_GLOBAL = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g;
  var RE_SKIP_IN_SEARCH = /[\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/;
  var RE_WHITESPACE_CHAR = /\s/;
  var RE_WORD_HAS_ALNUM = /[\p{L}\p{N}]/u;

  var _uidSeq = 0;

  /**
   * Converts Arabic-Indic (\u0660-\u0669), Extended Arabic-Indic (\u06F0-\u06F9),
   * and Fullwidth (\uFF10-\uFF19) digits to standard 0-9 numerals.
   */
  function toEasternDigits(str) {
    if (str === null || str === undefined) return '';
    var s = String(str);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code >= 0x0660 && code <= 0x0669) {
        out += String.fromCharCode(code - 0x0660 + 48);
      } else if (code >= 0x06F0 && code <= 0x06F9) {
        out += String.fromCharCode(code - 0x06F0 + 48);
      } else if (code >= 0xFF10 && code <= 0xFF19) {
        out += String.fromCharCode(code - 0xFF10 + 48);
      } else {
        out += s.charAt(i);
      }
    }
    return out;
  }

  /**
   * Formats a number using strictly 0-9 digits with en-US thousands separators.
   */
  function formatNum(n) {
    var raw = typeof n === 'string' ? toEasternDigits(n).replace(/,/g, '').trim() : n;
    var num = Number(raw || 0);
    if (!Number.isFinite(num)) return '0';
    return toEasternDigits(num.toLocaleString('en-US'));
  }

  /**
   * Maps a single character to its normalized search representation.
   * Returns null for combining marks ('mark') or kashida/bidi ('skip') handled by caller.
   */
  function mapBaseCharForSearch(ch, code) {
    if (code >= 0x0660 && code <= 0x0669) {
      return String.fromCharCode(code - 0x0660 + 48);
    }
    if (code >= 0x06F0 && code <= 0x06F9) {
      return String.fromCharCode(code - 0x06F0 + 48);
    }
    if (code >= 0xFF10 && code <= 0xFF19) {
      return String.fromCharCode(code - 0xFF10 + 48);
    }
    switch (code) {
      // Alef variants: آ أ إ ٱ ٲ ٳ ٵ -> ا
      case 0x0622:
      case 0x0623:
      case 0x0625:
      case 0x0671:
      case 0x0672:
      case 0x0673:
      case 0x0675:
        return '\u0627';
      // Teh marbuta & Heh variants: ة ۀ ہ ۃ ە -> ه
      case 0x0629:
      case 0x06C0:
      case 0x06C1:
      case 0x06C3:
      case 0x06D5:
        return '\u0647';
      // Alef maksura, Yeh with hamza, Farsi Yeh: ى ئ ی -> ي
      case 0x0649:
      case 0x0626:
      case 0x06CC:
        return '\u064A';
      // Waw with hamza: ؤ -> و
      case 0x0624:
        return '\u0648';
      // Keheh: ک -> ك
      case 0x06A9:
        return '\u0643';
      // Arabic presentation ligatures Lam-Alef -> لا
      case 0xFEF5:
      case 0xFEF6:
      case 0xFEF7:
      case 0xFEF8:
      case 0xFEF9:
      case 0xFEFA:
      case 0xFEFB:
      case 0xFEFC:
        return '\u0644\u0627';
      // Allah ligature -> الله
      case 0xFDF2:
        return '\u0627\u0644\u0644\u0647';
      default:
        return ch.toLowerCase();
    }
  }

  /**
   * Builds both the normalized search string and an index mapping array `normToOrigMap`
   * where `normToOrigMap[k] = [origStart, origEndExclusive]` in `str`.
   * Trailing combining marks (tashkeel, dagger alef, Quranic marks) immediately following
   * a base letter extend that letter's `origEndExclusive` so vocalized suffixes stay intact.
   */
  function buildNormalizedSearchMap(str) {
    var s = str === null || str === undefined ? '' : String(str);
    var normChars = [];
    var normToOrigMap = [];

    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var code = s.charCodeAt(i);

      if (RE_COMBINING_MARKS.test(ch)) {
        var lastIdx = normChars.length - 1;
        if (
          lastIdx >= 0 &&
          normChars[lastIdx] !== ' ' &&
          normToOrigMap[lastIdx][1] === i
        ) {
          normToOrigMap[lastIdx][1] = i + 1;
        }
        continue;
      }

      if (RE_SKIP_IN_SEARCH.test(ch)) {
        // Keep trailing diacritics attached across mid-letter invisible/kashida marks only inside spans
        continue;
      }

      if (RE_WHITESPACE_CHAR.test(ch)) {
        if (normChars.length === 0) continue;
        if (normChars[normChars.length - 1] === ' ') {
          normToOrigMap[normToOrigMap.length - 1][1] = i + 1;
        } else {
          normChars.push(' ');
          normToOrigMap.push([i, i + 1]);
        }
        continue;
      }

      var mapped = mapBaseCharForSearch(ch, code);
      if (!mapped) continue;

      for (var m = 0; m < mapped.length; m++) {
        normChars.push(mapped.charAt(m));
        normToOrigMap.push([i, i + 1]);
      }
    }

    if (normChars.length > 0 && normChars[normChars.length - 1] === ' ') {
      normChars.pop();
      normToOrigMap.pop();
    }

    return {
      norm: normChars.join(''),
      normToOrigMap: normToOrigMap
    };
  }

  /**
   * Normalizes Arabic & mixed text for search indexing and querying:
   * lowercases, converts digits to 0-9, strips tashkeel/dagger-alef/Quranic marks,
   * strips kashida & hidden bidi marks, unifies hamzas/teh-marbuta/alef-maksura,
   * and collapses whitespace.
   */
  function normalizeForSearch(str) {
    if (str === null || str === undefined) return '';
    return buildNormalizedSearchMap(str).norm;
  }

  /**
   * Cleans text according to project typography & Obsidian/Markdown rules:
   * - NFC normalization
   * - 0-9 numerals only
   * - Strips hidden RTL/LTR/bidi marks (\u200f, \u200e, \u061c, \ufeff, etc.)
   * - Optionally strips tashkeel when opts.stripTashkeel is truthy
   * - Optionally converts < > to « » when opts.escapeAngles is truthy
   * - Normalizes horizontal spaces and Arabic punctuation spacing while preserving line breaks
   */
  function cleanTextRules(str, opts) {
    if (str === null || str === undefined) return '';
    var options = opts || {};
    var out = String(str).replace(/\r\n?/g, '\n');

    if (typeof out.normalize === 'function') {
      out = out.normalize('NFC');
    }

    out = toEasternDigits(out);
    out = out.replace(RE_BIDI_HIDDEN_GLOBAL, '');
    out = out.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t]/g, ' ');

    if (options.stripTashkeel) {
      out = out.replace(RE_TASHKEEL_GLOBAL, '');
    }

    if (options.stripKashida) {
      out = out.replace(/\u0640/g, '');
    }

    if (options.escapeAngles) {
      out = out.replace(/</g, '\u00AB').replace(/>/g, '\u00BB');
    }

    // Collapse repeated horizontal spaces and tighten spaces before Arabic closing punctuation
    out = out
      .replace(/ {2,}/g, ' ')
      .replace(/ +([،؛؟])/g, '$1')
      .replace(/ +\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    return options.preserveEdges ? out : out.trim();
  }

  /**
   * Escapes HTML special characters safely.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Counts real words (tokens containing at least one letter or digit).
   */
  function countWords(str) {
    if (str === null || str === undefined) return 0;
    var trimmed = String(str).trim();
    if (!trimmed) return 0;
    var tokens = trimmed.split(/\s+/);
    var count = 0;
    for (var i = 0; i < tokens.length; i++) {
      if (RE_WORD_HAS_ALNUM.test(tokens[i])) {
        count++;
      }
    }
    return count;
  }

  /**
   * Formats estimated reading/speaking duration using 0-9 numerals.
   * Examples: "أقل من دقيقة", "14 د", "1 س 25 د", "2 س".
   */
  function formatDuration(words, wpm) {
    var w = Math.max(0, Number(words) || 0);
    var rate = Math.max(1, Number(wpm) || 130);
    if (w === 0) return '0 د';
    if (w < rate) return 'أقل من دقيقة';
    var totalMins = Math.max(1, Math.round(w / rate));
    if (totalMins < 60) {
      return toEasternDigits(String(totalMins)) + ' د';
    }
    var hours = Math.floor(totalMins / 60);
    var remMins = totalMins % 60;
    if (remMins === 0) {
      return toEasternDigits(String(hours)) + ' س';
    }
    return toEasternDigits(String(hours)) + ' س ' + toEasternDigits(String(remMins)) + ' د';
  }

  /**
   * Checks whether a UTF-16 code unit belongs to an Arabic word (letter, tashkeel, or kashida)
   * so mid-word matches expand cleanly to avoid breaking Arabic cursive ligatures.
   */
  function isArabicWordCode(code) {
    return (
      (code >= 0x0621 && code <= 0x063A) ||
      (code >= 0x0640 && code <= 0x065F) ||
      (code >= 0x066E && code <= 0x06D3) ||
      code === 0x06D5 ||
      (code >= 0x06DF && code <= 0x06ED) ||
      (code >= 0x06FA && code <= 0x06FC) ||
      (code >= 0x0610 && code <= 0x061A)
    );
  }

  function isLowSurrogate(code) {
    return code >= 0xDC00 && code <= 0xDFFF;
  }

  function isHighSurrogate(code) {
    return code >= 0xD800 && code <= 0xDBFF;
  }

  /**
   * Snaps a snippet start index cleanly to a nearby whitespace boundary without cutting
   * inside surrogates, combining marks, or past `maxIdx`.
   */
  function snapWindowStart(text, rawStart, maxIdx) {
    if (rawStart <= 0) return 0;
    var s = rawStart;
    var backLimit = Math.max(0, rawStart - 28);
    var fwdLimit = Math.min(maxIdx, rawStart + 16);

    // Prefer snapping backward to the start of the cut word if close
    var backSpace = text.lastIndexOf(' ', rawStart);
    if (backSpace !== -1 && backSpace >= backLimit) {
      s = backSpace + 1;
    } else {
      var fwdSpace = text.indexOf(' ', rawStart);
      if (fwdSpace !== -1 && fwdSpace < fwdLimit) {
        s = fwdSpace + 1;
      }
    }

    while (s > 0 && s < text.length && (isLowSurrogate(text.charCodeAt(s)) || RE_COMBINING_MARKS.test(text.charAt(s)))) {
      s--;
    }
    return Math.min(s, maxIdx);
  }

  /**
   * Snaps a snippet end index cleanly to a nearby whitespace boundary without cutting
   * inside surrogates, combining marks, or before `minIdx`.
   */
  function snapWindowEnd(text, rawEnd, minIdx) {
    var len = text.length;
    if (rawEnd >= len) return len;
    var e = rawEnd;
    var fwdLimit = Math.min(len, rawEnd + 28);
    var backLimit = Math.max(minIdx, rawEnd - 16);

    var fwdSpace = text.indexOf(' ', rawEnd);
    if (fwdSpace !== -1 && fwdSpace <= fwdLimit) {
      e = fwdSpace;
    } else {
      var backSpace = text.lastIndexOf(' ', rawEnd);
      if (backSpace !== -1 && backSpace >= backLimit) {
        e = backSpace;
      }
    }

    while (e < len && (RE_COMBINING_MARKS.test(text.charAt(e)) || (e > 0 && isHighSurrogate(text.charCodeAt(e - 1))))) {
      e++;
    }
    return Math.max(e, minIdx);
  }

  /**
   * Highlights query matches inside `text` using `<mark class="q-mark">...</mark>`
   * while escaping all HTML safely. Uses `normToOrigMap` so normalized queries
   * (e.g. "الاخلاص" or "قران") accurately highlight vocalized/hamzated original words
   * ("الإِخْلَاصُ" or "الْقُرْآنِ").
   * When `snippetRadius > 0`, extracts a centered window around the first match with "...".
   */
  function highlightMatches(text, query, snippetRadius) {
    var src = text === null || text === undefined ? '' : String(text);
    if (!src) return '';

    var radius = Number(snippetRadius) || 0;
    var normQuery = normalizeForSearch(query);

    if (!normQuery) {
      if (radius > 0 && src.length > radius * 2) {
        var cutEnd = snapWindowEnd(src, radius * 2, 1);
        return escapeHtml(src.slice(0, cutEnd).trimEnd()) + (cutEnd < src.length ? '...' : '');
      }
      return escapeHtml(src);
    }

    var mapped = buildNormalizedSearchMap(src);
    var normText = mapped.norm;
    var normToOrigMap = mapped.normToOrigMap;

    if (!normText) {
      return escapeHtml(src);
    }

    // Deduplicate non-empty query tokens, longest first
    var rawTokens = normQuery.split(' ');
    var seenTokens = Object.create(null);
    var tokens = [];
    for (var t = 0; t < rawTokens.length; t++) {
      var tok = rawTokens[t];
      if (tok && !seenTokens[tok]) {
        seenTokens[tok] = true;
        tokens.push(tok);
      }
    }
    tokens.sort(function (a, b) {
      return b.length - a.length;
    });

    var intervals = [];
    for (var ti = 0; ti < tokens.length; ti++) {
      var token = tokens[ti];
      var tLen = token.length;
      var fromIdx = 0;
      while (fromIdx <= normText.length - tLen) {
        var found = normText.indexOf(token, fromIdx);
        if (found === -1) break;

        var origStart = normToOrigMap[found][0];
        var origEnd = normToOrigMap[found + tLen - 1][1];

        // If the matched span starts or ends on an Arabic word character, expand to full Arabic word
        // so cursive shaping is never broken mid-word and vocalized words highlight cleanly.
        if (isArabicWordCode(src.charCodeAt(origStart))) {
          while (origStart > 0 && isArabicWordCode(src.charCodeAt(origStart - 1))) {
            origStart--;
          }
        }
        if (origEnd > origStart && isArabicWordCode(src.charCodeAt(origEnd - 1))) {
          while (origEnd < src.length && isArabicWordCode(src.charCodeAt(origEnd))) {
            origEnd++;
          }
        }

        intervals.push([origStart, origEnd]);
        fromIdx = found + Math.max(1, tLen);
      }
    }

    if (intervals.length === 0) {
      if (radius > 0 && src.length > radius * 2) {
        var plainEnd = snapWindowEnd(src, radius * 2, 1);
        return escapeHtml(src.slice(0, plainEnd).trimEnd()) + (plainEnd < src.length ? '...' : '');
      }
      return escapeHtml(src);
    }

    // Sort and merge overlapping or identical intervals
    intervals.sort(function (a, b) {
      return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
    });

    var merged = [intervals[0].slice()];
    for (var k = 1; k < intervals.length; k++) {
      var prev = merged[merged.length - 1];
      var cur = intervals[k];
      if (cur[0] <= prev[1]) {
        if (cur[1] > prev[1]) prev[1] = cur[1];
      } else {
        merged.push(cur.slice());
      }
    }

    var winStart = 0;
    var winEnd = src.length;
    var prefixEllipsis = '';
    var suffixEllipsis = '';

    if (radius > 0) {
      var firstStart = merged[0][0];
      var firstEnd = merged[0][1];
      var rawWinStart = Math.max(0, firstStart - radius);
      var rawWinEnd = Math.min(src.length, firstEnd + radius);

      // Rebalance window budget if near start or end of paragraph
      if (rawWinStart === 0 && rawWinEnd < src.length) {
        rawWinEnd = Math.min(src.length, Math.max(rawWinEnd, firstEnd + radius, radius * 2));
      } else if (rawWinEnd === src.length && rawWinStart > 0) {
        rawWinStart = Math.max(0, Math.min(rawWinStart, src.length - radius * 2));
      }

      winStart = snapWindowStart(src, rawWinStart, firstStart);
      winEnd = snapWindowEnd(src, rawWinEnd, firstEnd);

      if (winStart > 0) prefixEllipsis = '... ';
      if (winEnd < src.length) suffixEllipsis = ' ...';
    }

    var html = prefixEllipsis;
    var cursor = winStart;

    for (var mi = 0; mi < merged.length; mi++) {
      var sIdx = merged[mi][0];
      var eIdx = merged[mi][1];
      if (eIdx <= winStart) continue;
      if (sIdx >= winEnd) break;

      var clampedStart = Math.max(winStart, sIdx);
      var clampedEnd = Math.min(winEnd, eIdx);

      if (clampedStart > cursor) {
        html += escapeHtml(src.slice(cursor, clampedStart));
      }
      html += '<mark class="q-mark">' + escapeHtml(src.slice(clampedStart, clampedEnd)) + '</mark>';
      cursor = clampedEnd;
    }

    if (cursor < winEnd) {
      html += escapeHtml(src.slice(cursor, winEnd));
    }

    return html + suffixEllipsis;
  }

  /**
   * Tokenizes text into words and explicit '\n' newline markers for clean word-level diffing.
   */
  function tokenizeForDiff(str) {
    if (!str) return [];
    var normalized = String(str).replace(/\r\n?/g, '\n');
    var lines = normalized.split('\n');
    var tokens = [];
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (trimmed) {
        var words = trimmed.split(/\s+/);
        for (var j = 0; j < words.length; j++) {
          if (words[j]) tokens.push(words[j]);
        }
      }
      if (i < lines.length - 1) {
        tokens.push('\n');
      }
    }
    return tokens;
  }

  /**
   * Exact LCS diff on medium-sized token slices `a` and `b`.
   */
  function lcsDiffOps(a, b) {
    var n = a.length;
    var m = b.length;
    var cols = m + 1;
    var dp = new Int32Array((n + 1) * cols);

    for (var i = n - 1; i >= 0; i--) {
      var rowOffset = i * cols;
      var nextRowOffset = (i + 1) * cols;
      var ai = a[i];
      for (var j = m - 1; j >= 0; j--) {
        if (ai === b[j]) {
          dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
        } else {
          var down = dp[nextRowOffset + j];
          var right = dp[rowOffset + j + 1];
          dp[rowOffset + j] = down >= right ? down : right;
        }
      }
    }

    var ops = [];
    var x = 0;
    var y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) {
        ops.push({ type: 'eq', token: a[x] });
        x++;
        y++;
      } else if (dp[(x + 1) * cols + y] >= dp[x * cols + (y + 1)]) {
        ops.push({ type: 'del', token: a[x] });
        x++;
      } else {
        ops.push({ type: 'ins', token: b[y] });
        y++;
      }
    }
    while (x < n) {
      ops.push({ type: 'del', token: a[x++] });
    }
    while (y < m) {
      ops.push({ type: 'ins', token: b[y++] });
    }
    return ops;
  }

  /**
   * Windowed greedy anchor diff fallback when `n * m` exceeds the safe LCS DP budget.
   */
  function windowedFallbackDiffOps(a, b) {
    var ops = [];
    var i = 0;
    var j = 0;
    var n = a.length;
    var m = b.length;
    var LOOKAHEAD = 60;

    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: 'eq', token: a[i] });
        i++;
        j++;
        continue;
      }

      var foundA = -1;
      var foundB = -1;
      var maxDist = LOOKAHEAD;

      for (var dist = 1; dist <= maxDist; dist++) {
        if (i + dist < n && a[i + dist] === b[j]) {
          foundA = i + dist;
          foundB = j;
          break;
        }
        if (j + dist < m && a[i] === b[j + dist]) {
          foundA = i;
          foundB = j + dist;
          break;
        }
      }

      if (foundA !== -1) {
        while (i < foundA) ops.push({ type: 'del', token: a[i++] });
        while (j < foundB) ops.push({ type: 'ins', token: b[j++] });
      } else {
        ops.push({ type: 'del', token: a[i++] });
        ops.push({ type: 'ins', token: b[j++] });
      }
    }

    while (i < n) ops.push({ type: 'del', token: a[i++] });
    while (j < m) ops.push({ type: 'ins', token: b[j++] });
    return ops;
  }

  function joinTokensEscaped(tokens) {
    var out = '';
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok === '\n') {
        out += '\n';
      } else {
        if (out && out.charAt(out.length - 1) !== '\n') {
          out += ' ';
        }
        out += escapeHtml(tok);
      }
    }
    return out;
  }

  /**
   * Computes a safe word-level diff HTML between `originalText` and `currentText`,
   * rendering deleted segments inside `<del class="diff-del">...</del>` and inserted
   * segments inside `<ins class="diff-ins">...</ins>`.
   * Uses prefix/suffix trimming + exact LCS DP with a 400,000-cell safety cap for huge texts.
   */
  function computeWordDiffHtml(originalText, currentText) {
    var origStr = originalText === null || originalText === undefined ? '' : String(originalText);
    var currStr = currentText === null || currentText === undefined ? '' : String(currentText);

    if (origStr === currStr) {
      return escapeHtml(currStr);
    }

    var origTokens = tokenizeForDiff(origStr);
    var currTokens = tokenizeForDiff(currStr);

    if (origTokens.length === 0 && currTokens.length === 0) return '';
    if (origTokens.length === 0) {
      return '<ins class="diff-ins">' + joinTokensEscaped(currTokens) + '</ins>';
    }
    if (currTokens.length === 0) {
      return '<del class="diff-del">' + joinTokensEscaped(origTokens) + '</del>';
    }

    // Trim unchanged prefix and suffix in O(N)
    var prefixLen = 0;
    var minLen = Math.min(origTokens.length, currTokens.length);
    while (prefixLen < minLen && origTokens[prefixLen] === currTokens[prefixLen]) {
      prefixLen++;
    }

    var suffixLen = 0;
    while (
      suffixLen < minLen - prefixLen &&
      origTokens[origTokens.length - 1 - suffixLen] === currTokens[currTokens.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    var midOrig = origTokens.slice(prefixLen, origTokens.length - suffixLen);
    var midCurr = currTokens.slice(prefixLen, currTokens.length - suffixLen);

    var MAX_DP_CELLS = 400000;
    var midOps;
    if (midOrig.length === 0 && midCurr.length === 0) {
      midOps = [];
    } else if (midOrig.length * midCurr.length <= MAX_DP_CELLS) {
      midOps = lcsDiffOps(midOrig, midCurr);
    } else {
      midOps = windowedFallbackDiffOps(midOrig, midCurr);
    }

    var allOps = [];
    for (var p = 0; p < prefixLen; p++) {
      allOps.push({ type: 'eq', token: origTokens[p] });
    }
    for (var m = 0; m < midOps.length; m++) {
      allOps.push(midOps[m]);
    }
    for (var s = origTokens.length - suffixLen; s < origTokens.length; s++) {
      allOps.push({ type: 'eq', token: origTokens[s] });
    }

    // Render grouped runs cleanly (<del> followed by <ins> within each change hunk)
    var parts = [];
    var idx = 0;
    while (idx < allOps.length) {
      if (allOps[idx].type === 'eq') {
        var eqRun = [];
        while (idx < allOps.length && allOps[idx].type === 'eq') {
          eqRun.push(allOps[idx].token);
          idx++;
        }
        parts.push({ html: joinTokensEscaped(eqRun), rawFirst: eqRun[0], rawLast: eqRun[eqRun.length - 1] });
      } else {
        var delRun = [];
        var insRun = [];
        while (idx < allOps.length && allOps[idx].type !== 'eq') {
          if (allOps[idx].type === 'del') {
            if (!(allOps[idx].token === '\n' && delRun.length === 0)) {
              delRun.push(allOps[idx].token);
            }
          } else if (allOps[idx].type === 'ins') {
            if (!(allOps[idx].token === '\n' && insRun.length === 0)) {
              insRun.push(allOps[idx].token);
            }
          }
          idx++;
        }
        var delText = joinTokensEscaped(delRun).trim();
        var insText = joinTokensEscaped(insRun).trim();
        if (delText) {
          parts.push({ html: '<del class="diff-del">' + delText + '</del>', rawFirst: '', rawLast: '' });
        }
        if (insText) {
          parts.push({ html: '<ins class="diff-ins">' + insText + '</ins>', rawFirst: '', rawLast: '' });
        }
      }
    }

    var result = '';
    for (var r = 0; r < parts.length; r++) {
      var chunk = parts[r].html;
      if (!chunk) continue;
      if (
        result &&
        result.charAt(result.length - 1) !== '\n' &&
        chunk.charAt(0) !== '\n'
      ) {
        result += ' ';
      }
      result += chunk;
    }
    return result;
  }

  /**
   * Copies text to the clipboard using Clipboard API with a hidden <textarea> fallback
   * (works across https://, http://127.0.0.1, and file://).
   */
  async function copyText(text) {
    var str = text === null || text === undefined ? '' : String(text);
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(str);
        return true;
      } catch (_) {
        // Fallback below for file:// or restricted contexts
      }
    }

    if (typeof document === 'undefined' || !document.body) {
      return false;
    }

    try {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.right = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      if (typeof ta.setSelectionRange === 'function') {
        ta.setSelectionRange(0, str.length);
      }
      var copied = document.execCommand('copy');
      document.body.removeChild(ta);
      return Boolean(copied);
    } catch (_) {
      return false;
    }
  }

  /**
   * Triggers a browser file download for text/Markdown/JSON content.
   */
  function downloadTextFile(filename, content, mime) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
      return false;
    }
    var safeName = toEasternDigits(String(filename || 'qabas-export.md'))
      .replace(/[\\/:*?"<>|]+/g, '_')
      .trim() || 'qabas-export.md';
    if (typeof safeName.normalize === 'function') {
      safeName = safeName.normalize('NFC');
    }

    var mimeType = mime || 'text/markdown;charset=utf-8';
    var blob = new Blob([content === null || content === undefined ? '' : String(content)], {
      type: mimeType
    });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
    return true;
  }

  /**
   * Opens a clean RTL book-styled print view (popup window with hidden-iframe fallback).
   */
  function openPrintView(title, subtitle, htmlBody) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    var safeTitle = escapeHtml(toEasternDigits(title || 'قبس'));
    var safeSubtitle = subtitle ? escapeHtml(toEasternDigits(subtitle)) : '';
    var rawBody = htmlBody === null || htmlBody === undefined ? '' : String(htmlBody);
    var bodyContent = /<[a-z][\s\S]*>/i.test(rawBody)
      ? rawBody
      : rawBody
          .split(/\n{2,}/)
          .map(function (p) {
            var t = p.trim();
            return t ? '<p>' + escapeHtml(t) + '</p>' : '';
          })
          .join('\n');

    var docHtml =
      '<!DOCTYPE html>\n' +
      '<html lang="ar" dir="rtl">\n' +
      '<head>\n' +
      '  <meta charset="utf-8">\n' +
      '  <title>' + safeTitle + '</title>\n' +
      '  <style>\n' +
      '    @page { size: A4; margin: 20mm 18mm; }\n' +
      '    * { box-sizing: border-box; }\n' +
      '    body {\n' +
      '      margin: 0;\n' +
      '      padding: 28px 24px 48px;\n' +
      '      background: #FFFFFF;\n' +
      '      color: #111111;\n' +
      '      font-family: "IBM Plex Sans Arabic", "Amiri", "Traditional Arabic", "Geeza Pro", system-ui, sans-serif;\n' +
      '      font-size: 18px;\n' +
      '      line-height: 1.95;\n' +
      '      direction: rtl;\n' +
      '    }\n' +
      '    .print-bar {\n' +
      '      max-width: 760px;\n' +
      '      margin: 0 auto 24px;\n' +
      '      padding: 10px 14px;\n' +
      '      border: 1px solid #D0D7DE;\n' +
      '      border-radius: 8px;\n' +
      '      display: flex;\n' +
      '      align-items: center;\n' +
      '      justify-content: space-between;\n' +
      '      background: #F8FAFC;\n' +
      '      font-size: 14px;\n' +
      '    }\n' +
      '    .print-btn {\n' +
      '      padding: 6px 16px;\n' +
      '      border-radius: 9999px;\n' +
      '      border: 1px solid #111111;\n' +
      '      background: #111111;\n' +
      '      color: #FFFFFF;\n' +
      '      font-family: inherit;\n' +
      '      font-size: 13px;\n' +
      '      cursor: pointer;\n' +
      '    }\n' +
      '    .print-btn-ghost {\n' +
      '      background: transparent;\n' +
      '      color: #111111;\n' +
      '      border-color: #CBD5E1;\n' +
      '      margin-right: 8px;\n' +
      '    }\n' +
      '    .print-sheet {\n' +
      '      max-width: 760px;\n' +
      '      margin: 0 auto;\n' +
      '    }\n' +
      '    .print-header {\n' +
      '      border-bottom: 2px solid #111111;\n' +
      '      padding-bottom: 16px;\n' +
      '      margin-bottom: 28px;\n' +
      '    }\n' +
      '    .print-title {\n' +
      '      margin: 0 0 6px;\n' +
      '      font-size: 26px;\n' +
      '      line-height: 1.45;\n' +
      '      font-weight: 700;\n' +
      '    }\n' +
      '    .print-subtitle {\n' +
      '      margin: 0;\n' +
      '      font-size: 15px;\n' +
      '      color: #475569;\n' +
      '    }\n' +
      '    h1, h2, h3 {\n' +
      '      color: #0F172A;\n' +
      '      line-height: 1.5;\n' +
      '      page-break-after: avoid;\n' +
      '    }\n' +
      '    h2 { font-size: 22px; margin: 28px 0 12px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; }\n' +
      '    h3 { font-size: 19px; margin: 22px 0 10px; }\n' +
      '    p { margin: 0 0 16px; text-align: justify; }\n' +
      '    blockquote, .print-quote {\n' +
      '      margin: 16px 0;\n' +
      '      padding: 10px 16px;\n' +
      '      border-right: 3px solid #0F172A;\n' +
      '      background: #F8FAFC;\n' +
      '    }\n' +
      '    .print-note {\n' +
      '      margin: 14px 0;\n' +
      '      padding: 10px 14px;\n' +
      '      border: 1px dashed #94A3B8;\n' +
      '      border-radius: 6px;\n' +
      '      font-size: 15px;\n' +
      '      color: #334155;\n' +
      '    }\n' +
      '    mark.q-mark { background: #FEF08A; color: #111111; padding: 0 2px; }\n' +
      '    del.diff-del { color: #B91C1C; text-decoration: line-through; }\n' +
      '    ins.diff-ins { color: #047857; text-decoration: underline; }\n' +
      '    @media print {\n' +
      '      body { padding: 0; }\n' +
      '      .no-print { display: none !important; }\n' +
      '    }\n' +
      '  </style>\n' +
      '</head>\n' +
      '<body>\n' +
      '  <div class="print-bar no-print">\n' +
      '    <span>معاينة الطباعة وتصدير PDF</span>\n' +
      '    <div>\n' +
      '      <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>\n' +
      '      <button class="print-btn print-btn-ghost" onclick="window.close()">إغلاق</button>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '  <main class="print-sheet">\n' +
      '    <header class="print-header">\n' +
      '      <h1 class="print-title">' + safeTitle + '</h1>\n' +
      (safeSubtitle ? '      <p class="print-subtitle">' + safeSubtitle + '</p>\n' : '') +
      '    </header>\n' +
      '    <div class="print-body">\n' +
      bodyContent + '\n' +
      '    </div>\n' +
      '  </main>\n' +
      '  <script>\n' +
      '    window.addEventListener("load", function () {\n' +
      '      setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 180);\n' +
      '    });\n' +
      '  </script>\n' +
      '</body>\n' +
      '</html>';

    var win = null;
    try {
      win = window.open('', '_blank', 'width=920,height=780');
    } catch (_) {
      win = null;
    }

    if (win && win.document) {
      win.document.open();
      win.document.write(docHtml);
      win.document.close();
      return true;
    }

    // Fallback to hidden iframe if popup was blocked
    try {
      var iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      var idoc = iframe.contentWindow.document;
      idoc.open();
      idoc.write(docHtml);
      idoc.close();
      setTimeout(function () {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } finally {
          setTimeout(function () {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 2000);
        }
      }, 220);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Generates a unique short ID with monotonic sequence protection against same-ms collisions.
   */
  function uid(prefix) {
    var p = prefix || 'blk';
    _uidSeq = (_uidSeq + 1) % 1296;
    var rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
    return p + '_' + Date.now().toString(36) + '_' + rand + _uidSeq.toString(36);
  }

  var QabasUtils = {
    toEasternDigits: toEasternDigits,
    formatNum: formatNum,
    normalizeForSearch: normalizeForSearch,
    cleanTextRules: cleanTextRules,
    escapeHtml: escapeHtml,
    countWords: countWords,
    formatDuration: formatDuration,
    highlightMatches: highlightMatches,
    computeWordDiffHtml: computeWordDiffHtml,
    copyText: copyText,
    downloadTextFile: downloadTextFile,
    openPrintView: openPrintView,
    uid: uid
  };

  global.QabasUtils = QabasUtils;
  if (typeof window !== 'undefined') {
    window.QabasUtils = QabasUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);

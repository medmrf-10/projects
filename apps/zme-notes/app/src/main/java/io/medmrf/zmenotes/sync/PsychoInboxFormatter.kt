package io.medmrf.zmenotes.sync

import io.medmrf.zmenotes.model.NoteCategories
import java.util.Locale

data class AppendMarkdownResult(
    val sequenceNumber: Int,
    val formattedEntry: String,
    val updatedDocument: String
)

object PsychoInboxFormatter {

    const val INBOX_SECTION_HEADING = "## الملاحظات الواردة بانتظار التحليل"

    const val INITIAL_TEMPLATE =
        "# صندوق الملاحظات النفسية السريع (**PsychoInbox**)\n\n" +
            "## تنسيق التدوين التلقائي من التطبيق\n" +
            "1. تُضاف كل ملاحظة جديدة برقم متسلسل تلقائي تحت قسم **الملاحظات الواردة بانتظار التحليل** بترميز **UTF-8** وأرقام مشرقية (**1, 2, 3**) وبإزاحة جدولة حقيقية (**Tab**) دون أسطر فارغة أو نقاط غير مرقمة أو جداول أو أقواس زاوية.\n" +
            "2. يتفرع تحت كل تدوينة مرقمة التصنيف ومستوى الشدة عند اختياره ونص الملاحظة وحالة المراجعة (**بانتظار التحليل**) تمهيداً لتحليلها لاحقاً ودمجها في السجلات المعتمدة.\n\n" +
            "## الملاحظات الواردة بانتظار التحليل\n"

    private val topLevelNumberRegex = Regex("^([0-9]+)\\.\\s+")
    private val leadingBulletsRegex = Regex("^(?:[-*+•▪◦‣–—]+\\s+)+")
    private val onlyHorizontalRuleRegex = Regex("^[-*_•▪◦]+$")
    private val hiddenDirectionRegex = Regex("[\u200F\u200E\u061C\uFEFF]")
    private val multiSpacesRegex = Regex("[ \\t]{2,}")

    fun toAsciiDigits(input: String): String {
        if (input.isEmpty()) return input
        val sb = StringBuilder(input.length)
        for (ch in input) {
            when (ch) {
                in '\u0660'..'\u0669' -> sb.append(('0'.code + (ch.code - '\u0660'.code)).toChar())
                in '\u06F0'..'\u06F9' -> sb.append(('0'.code + (ch.code - '\u06F0'.code)).toChar())
                else -> sb.append(ch)
            }
        }
        return sb.toString()
    }

    fun sanitizeSingleLine(raw: String): String {
        var cleaned = raw
            .replace("\r\n", " ")
            .replace('\r', ' ')
            .replace('\n', ' ')
            .replace('\t', ' ')
        cleaned = hiddenDirectionRegex.replace(cleaned, "")
        cleaned = toAsciiDigits(cleaned)
        cleaned = cleaned
            .replace("<", "«")
            .replace(">", "»")
            .replace("|", " / ")
            .trim()
        cleaned = leadingBulletsRegex.replace(cleaned, "").trim()
        if (onlyHorizontalRuleRegex.matches(cleaned)) {
            return ""
        }
        cleaned = multiSpacesRegex.replace(cleaned, " ").trim()
        return cleaned
    }

    fun sanitizeNoteLines(rawNote: String): List<String> {
        val normalized = rawNote
            .replace("\r\n", "\n")
            .replace('\r', '\n')
        return normalized
            .split('\n')
            .map { sanitizeSingleLine(it) }
            .filter { it.isNotEmpty() }
    }

    fun ensureArabicStart(line: String): String {
        val trimmed = line.trim()
        if (trimmed.isEmpty()) return trimmed
        val first = trimmed.first()
        val isArabic = first in '\u0600'..'\u06FF' ||
            first in '\u0750'..'\u077F' ||
            first in '\u08A0'..'\u08FF' ||
            first in '\uFB50'..'\uFDFF' ||
            first in '\uFE70'..'\uFEFF'
        return if (isArabic) trimmed else "تفصيل: $trimmed"
    }

    fun nextSequenceNumber(existingMarkdown: String): Int {
        val normalized = existingMarkdown
            .replace("\r\n", "\n")
            .replace('\r', '\n')
        val lines = normalized.split('\n')
        val headingIdx = lines.indexOfFirst { it.trim() == INBOX_SECTION_HEADING }
        if (headingIdx == -1) return 1

        var maxSeq = 0
        for (i in (headingIdx + 1) until lines.size) {
            val line = lines[i]
            if (line.startsWith("## ") && line.trim() != INBOX_SECTION_HEADING) {
                break
            }
            val match = topLevelNumberRegex.find(line)
            if (match != null) {
                val n = match.groupValues[1].toIntOrNull()
                if (n != null && n > maxSeq) {
                    maxSeq = n
                }
            }
        }
        return maxSeq + 1
    }

    fun formatEntry(
        sequenceNumber: Int,
        dateYyyyMmDd: String,
        timeHhMm: String,
        category: String,
        intensity: Int?,
        rawNote: String
    ): String {
        val seqStr = String.format(Locale.US, "%d", sequenceNumber)
        val cleanDate = toAsciiDigits(sanitizeSingleLine(dateYyyyMmDd))
        val cleanTime = toAsciiDigits(sanitizeSingleLine(timeHhMm))
        val cleanCategory = sanitizeSingleLine(category)
            .replace("*", "")
            .ifBlank { NoteCategories.DEFAULT }
        val validIntensity = intensity?.takeIf { it in 1..5 }
        val lines = sanitizeNoteLines(rawNote).ifEmpty { listOf("ملاحظة بدون نص") }

        val out = mutableListOf<String>()
        out += "$seqStr. ملاحظة بتاريخ **$cleanDate** الساعة **$cleanTime**:"

        var subIdx = 1
        out += "\t${String.format(Locale.US, "%d", subIdx++)}. التصنيف: **$cleanCategory**"

        if (validIntensity != null) {
            val intStr = String.format(Locale.US, "%d", validIntensity)
            out += "\t${String.format(Locale.US, "%d", subIdx++)}. الشدة: **$intStr/5**"
        }

        if (lines.size == 1) {
            out += "\t${String.format(Locale.US, "%d", subIdx++)}. النص: ${lines[0]}"
        } else {
            out += "\t${String.format(Locale.US, "%d", subIdx++)}. النص:"
            lines.forEachIndexed { idx, line ->
                val childNum = String.format(Locale.US, "%d", idx + 1)
                out += "\t\t$childNum. ${ensureArabicStart(line)}"
            }
        }

        out += "\t${String.format(Locale.US, "%d", subIdx)}. الحالة: **بانتظار التحليل**"
        return out.joinToString("\n")
    }

    fun appendNote(
        existingContent: String?,
        dateYyyyMmDd: String,
        timeHhMm: String,
        category: String,
        intensity: Int?,
        rawNote: String
    ): AppendMarkdownResult {
        val baseRaw = if (existingContent.isNullOrBlank()) INITIAL_TEMPLATE else existingContent
        var normalized = baseRaw
            .replace("\r\n", "\n")
            .replace('\r', '\n')

        val lines = normalized.split('\n').toMutableList()
        var headingIdx = lines.indexOfFirst { it.trim() == INBOX_SECTION_HEADING }

        if (headingIdx == -1) {
            while (lines.isNotEmpty() && lines.last().isBlank()) {
                lines.removeAt(lines.lastIndex)
            }
            if (lines.isNotEmpty()) {
                lines.add("")
            }
            lines.add(INBOX_SECTION_HEADING)
            headingIdx = lines.lastIndex
            normalized = lines.joinToString("\n") + "\n"
        }

        val nextSeq = nextSequenceNumber(normalized)
        val entry = formatEntry(
            sequenceNumber = nextSeq,
            dateYyyyMmDd = dateYyyyMmDd,
            timeHhMm = timeHhMm,
            category = category,
            intensity = intensity,
            rawNote = rawNote
        )

        var nextSectionIdx = lines.size
        for (i in (headingIdx + 1) until lines.size) {
            if (lines[i].startsWith("## ")) {
                nextSectionIdx = i
                break
            }
        }

        val beforeSection = lines.subList(0, headingIdx + 1)
        val sectionBody = lines.subList(headingIdx + 1, nextSectionIdx)
            .filter { it.isNotBlank() }
        val afterSection = if (nextSectionIdx < lines.size) {
            lines.subList(nextSectionIdx, lines.size)
        } else {
            emptyList()
        }

        val rebuilt = mutableListOf<String>()
        rebuilt.addAll(beforeSection)
        rebuilt.addAll(sectionBody)
        rebuilt.addAll(entry.split('\n'))

        if (afterSection.isNotEmpty()) {
            rebuilt.add("")
            rebuilt.addAll(afterSection)
        }

        while (rebuilt.isNotEmpty() && rebuilt.last().isBlank()) {
            rebuilt.removeAt(rebuilt.lastIndex)
        }

        val finalDoc = rebuilt.joinToString("\n") + "\n"
        return AppendMarkdownResult(
            sequenceNumber = nextSeq,
            formattedEntry = entry,
            updatedDocument = finalDoc
        )
    }
}

package io.medmrf.zmenotes

import io.medmrf.zmenotes.sync.PsychoInboxFormatter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PsychoInboxFormatterTest {

    @Test
    fun freshTemplateStartsAtSequenceOneIgnoringEarlierSectionNumbers() {
        val result = PsychoInboxFormatter.appendNote(
            existingContent = PsychoInboxFormatter.INITIAL_TEMPLATE,
            dateYyyyMmDd = "2026-11-22",
            timeHhMm = "07:45",
            category = "تفكير وتركيز",
            intensity = 4,
            rawNote = "تشتت سريع عند التنقل بين المهام"
        )

        assertEquals(1, result.sequenceNumber)
        val expectedEntry =
            "1. ملاحظة بتاريخ **2026-11-22** الساعة **07:45**:\n" +
                "\t1. التصنيف: **تفكير وتركيز**\n" +
                "\t2. الشدة: **4/5**\n" +
                "\t3. النص: تشتت سريع عند التنقل بين المهام\n" +
                "\t4. الحالة: **بانتظار التحليل**"
        assertEquals(expectedEntry, result.formattedEntry)
        assertTrue(
            result.updatedDocument.contains(
                "## الملاحظات الواردة بانتظار التحليل\n1. ملاحظة بتاريخ **2026-11-22** الساعة **07:45**:\n"
            )
        )
        assertTrue(result.updatedDocument.endsWith("\n"))
        assertFalse(result.updatedDocument.endsWith("\n\n"))
    }

    @Test
    fun sequentialAppendsIncrementWithoutBlankLinesAndOmitIntensityWhenNull() {
        val first = PsychoInboxFormatter.appendNote(
            existingContent = null,
            dateYyyyMmDd = "2026-11-22",
            timeHhMm = "08:00",
            category = "نوم وطاقة",
            intensity = 3,
            rawNote = "استيقاظ مبكر بنشاط متوسط"
        )

        val second = PsychoInboxFormatter.appendNote(
            existingContent = first.updatedDocument,
            dateYyyyMmDd = "2026-11-22",
            timeHhMm = "10:15",
            category = "",
            intensity = null,
            rawNote = "لحظة هدوء بعد المشي"
        )

        assertEquals(2, second.sequenceNumber)
        val expectedSecond =
            "2. ملاحظة بتاريخ **2026-11-22** الساعة **10:15**:\n" +
                "\t1. التصنيف: **ملاحظة عامة**\n" +
                "\t2. النص: لحظة هدوء بعد المشي\n" +
                "\t3. الحالة: **بانتظار التحليل**"
        assertEquals(expectedSecond, second.formattedEntry)

        // Ensure zero blank lines anywhere inside the inbox section
        val inboxPart = second.updatedDocument
            .substringAfter(PsychoInboxFormatter.INBOX_SECTION_HEADING + "\n")
            .trimEnd('\n')
        assertFalse("Blank line found inside inbox list", inboxPart.contains("\n\n"))
        assertTrue(inboxPart.contains("\t4. الحالة: **بانتظار التحليل**\n2. ملاحظة بتاريخ"))
    }

    @Test
    fun multiLineNoteUsesDoubleTabSubListAndEnforcesArabicRtlLineStart() {
        val raw = "  - شعور بضغط قبل الاجتماع  \n\n* Focus dropped after 20 min\n• تنفس عميق ساعدني"
        val result = PsychoInboxFormatter.appendNote(
            existingContent = PsychoInboxFormatter.INITIAL_TEMPLATE,
            dateYyyyMmDd = "2026-11-22",
            timeHhMm = "14:30",
            category = "موقف وتوتر",
            intensity = 5,
            rawNote = raw
        )

        val expected =
            "1. ملاحظة بتاريخ **2026-11-22** الساعة **14:30**:\n" +
                "\t1. التصنيف: **موقف وتوتر**\n" +
                "\t2. الشدة: **5/5**\n" +
                "\t3. النص:\n" +
                "\t\t1. شعور بضغط قبل الاجتماع\n" +
                "\t\t2. تفصيل: Focus dropped after 20 min\n" +
                "\t\t3. تنفس عميق ساعدني\n" +
                "\t4. الحالة: **بانتظار التحليل**"
        assertEquals(expected, result.formattedEntry)
    }

    @Test
    fun strictObsidianVaultModeSanitizationCompliance() {
        val dirtyNote = "\uFEFF\u200F- <توتر> مع | جدول | وأرقام هندية ١٢٣\u061C\n---\n* نقطة ثانية > اختبار"
        val result = PsychoInboxFormatter.appendNote(
            existingContent = PsychoInboxFormatter.INITIAL_TEMPLATE,
            dateYyyyMmDd = "٢٠٢٦-١١-٢٢",
            timeHhMm = "٠٩:٠٥",
            category = "تشتت واندفاع",
            intensity = 2,
            rawNote = dirtyNote
        )

        val doc = result.updatedDocument
        // Zero angle brackets
        assertFalse(doc.contains('<'))
        assertFalse(doc.contains('>'))
        // Zero Markdown table pipes
        assertFalse(doc.contains('|'))
        // Zero hidden direction/BOM marks
        assertFalse(doc.contains('\u200F'))
        assertFalse(doc.contains('\u061C'))
        assertFalse(doc.contains('\uFEFF'))
        // Zero Arabic-Indic digits
        assertFalse(doc.any { it in '\u0660'..'\u0669' || it in '\u06F0'..'\u06F9' })
        // Zero unordered bullets (- or *) at line starts
        val lines = doc.trimEnd('\n').split('\n')
        assertTrue(lines.none { it.trimStart().startsWith("- ") || it.trimStart().startsWith("* ") })
        // Proper replacements applied
        assertTrue(doc.contains("«توتر»"))
        assertTrue(doc.contains("123"))
        assertTrue(doc.contains("2026-11-22"))
        assertTrue(doc.contains("09:05"))
    }
}

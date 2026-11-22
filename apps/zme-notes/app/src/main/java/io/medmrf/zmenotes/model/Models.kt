package io.medmrf.zmenotes.model

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class SyncStatus {
    PENDING,
    SYNCED
}

data class NoteRecord(
    val id: Long = 0L,
    val content: String,
    val category: String,
    val intensity: Int? = null,
    val createdAtEpochMs: Long,
    val formattedDate: String,
    val formattedTime: String,
    val syncStatus: SyncStatus = SyncStatus.PENDING,
    val lastError: String? = null,
    val syncedAtEpochMs: Long? = null,
    val remoteCommitSha: String? = null
)

data class GitHubConfig(
    val owner: String = DEFAULT_OWNER,
    val repo: String = DEFAULT_REPO,
    val branch: String = DEFAULT_BRANCH,
    val filePath: String = DEFAULT_FILE_PATH,
    val token: String = ""
) {
    fun normalized(): GitHubConfig = copy(
        owner = owner.trim(),
        repo = repo.trim(),
        branch = branch.trim(),
        filePath = filePath.trim().trimStart('/'),
        token = token.trim()
    )

    fun isConfigured(): Boolean {
        val n = normalized()
        return n.owner.isNotEmpty() &&
            n.repo.isNotEmpty() &&
            n.branch.isNotEmpty() &&
            n.filePath.isNotEmpty() &&
            n.token.isNotEmpty()
    }

    companion object {
        const val DEFAULT_OWNER = "medmrf-10"
        const val DEFAULT_REPO = "zme"
        const val DEFAULT_BRANCH = "main"
        const val DEFAULT_FILE_PATH = "ALL/health/psycho/PsychoInbox.md"
    }
}

object NoteCategories {
    const val DEFAULT = "ملاحظة عامة"

    val ALL: List<String> = listOf(
        "تفكير وتركيز",
        "نوم وطاقة",
        "موقف وتوتر",
        "تشتت واندفاع",
        "عادة ورغبة",
        "ملاحظة عامة"
    )
}

object TimestampFormatter {
    private val dateFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)
    private val timeFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("HH:mm", Locale.US)

    fun formatDate(epochMs: Long, zoneId: ZoneId = ZoneId.systemDefault()): String {
        return Instant.ofEpochMilli(epochMs).atZone(zoneId).format(dateFormatter)
    }

    fun formatTime(epochMs: Long, zoneId: ZoneId = ZoneId.systemDefault()): String {
        return Instant.ofEpochMilli(epochMs).atZone(zoneId).format(timeFormatter)
    }
}

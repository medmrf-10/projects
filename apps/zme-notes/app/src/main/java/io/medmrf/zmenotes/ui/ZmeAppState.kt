package io.medmrf.zmenotes.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.medmrf.zmenotes.data.CaptureOutcome
import io.medmrf.zmenotes.data.NoteQueueManager
import io.medmrf.zmenotes.data.SecureSettingsStore
import io.medmrf.zmenotes.data.SingleSyncOutcome
import io.medmrf.zmenotes.model.GitHubConfig
import io.medmrf.zmenotes.model.NoteRecord
import io.medmrf.zmenotes.model.SyncStatus
import io.medmrf.zmenotes.sync.ConnectionTestResult
import io.medmrf.zmenotes.sync.NoteSyncGateway
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppTab {
    COMPOSE,
    HISTORY,
    SETTINGS
}

enum class BannerTone {
    SUCCESS,
    PENDING,
    INFO,
    ERROR
}

data class StatusBanner(
    val message: String,
    val tone: BannerTone
)

class ZmeAppController(
    private val settingsStore: SecureSettingsStore,
    private val queueManager: NoteQueueManager,
    private val syncGateway: NoteSyncGateway,
    private val scope: CoroutineScope
) {
    var darkTheme by mutableStateOf(settingsStore.isDarkTheme())
        private set

    var selectedTab by mutableStateOf(AppTab.COMPOSE)

    var noteDraft by mutableStateOf("")
    var selectedCategory by mutableStateOf<String?>(null)
    var selectedIntensity by mutableStateOf<Int?>(null)

    var isSubmitting by mutableStateOf(false)
        private set
    var isSyncingBatch by mutableStateOf(false)
        private set
    var syncingNoteId by mutableStateOf<Long?>(null)
        private set

    var statusBanner by mutableStateOf<StatusBanner?>(null)
        private set

    var notes by mutableStateOf<List<NoteRecord>>(emptyList())
        private set

    var config by mutableStateOf(settingsStore.loadConfig())
        private set

    var isTestingConnection by mutableStateOf(false)
        private set
    var connectionBanner by mutableStateOf<StatusBanner?>(null)
        private set

    val pendingCount: Int
        get() = notes.count { it.syncStatus == SyncStatus.PENDING }

    init {
        refreshNotes()
    }

    fun toggleTheme() {
        val next = !darkTheme
        darkTheme = next
        settingsStore.setDarkTheme(next)
    }

    fun dismissBanner() {
        statusBanner = null
    }

    fun showTransientMessage(message: String, tone: BannerTone = BannerTone.INFO) {
        statusBanner = StatusBanner(message, tone)
    }

    fun appendDictatedText(spoken: String) {
        val trimmed = spoken.trim()
        if (trimmed.isEmpty()) return
        noteDraft = if (noteDraft.isBlank()) {
            trimmed
        } else {
            val sep = if (noteDraft.endsWith(" ") || noteDraft.endsWith("\n")) "" else " "
            noteDraft + sep + trimmed
        }
    }

    fun refreshNotes() {
        scope.launch {
            val loaded = withContext(Dispatchers.IO) { queueManager.getAllNotes() }
            notes = loaded
        }
    }

    fun submitNote() {
        val text = noteDraft.trim()
        if (text.isEmpty() || isSubmitting) return

        val categoryToSave = selectedCategory
        val intensityToSave = selectedIntensity
        val activeConfig = config

        isSubmitting = true
        // Clear input immediately for ADHD-friendly zero friction capture
        noteDraft = ""
        selectedCategory = null
        selectedIntensity = null

        scope.launch {
            try {
                val outcome = withContext(Dispatchers.IO) {
                    queueManager.captureAndTrySync(
                        rawContent = text,
                        category = categoryToSave,
                        intensity = intensityToSave,
                        config = activeConfig
                    )
                }
                notes = withContext(Dispatchers.IO) { queueManager.getAllNotes() }
                statusBanner = when (outcome) {
                    is CaptureOutcome.Synced -> StatusBanner(outcome.userMessage, BannerTone.SUCCESS)
                    is CaptureOutcome.SavedPendingOffline -> StatusBanner(outcome.userMessage, BannerTone.PENDING)
                    is CaptureOutcome.SavedNoToken -> StatusBanner(outcome.userMessage, BannerTone.INFO)
                }
            } catch (_: Exception) {
                statusBanner = StatusBanner("حدث خطأ غير متوقع أثناء الحفظ", BannerTone.ERROR)
            } finally {
                isSubmitting = false
            }
        }
    }

    fun syncSingleNote(noteId: Long) {
        if (syncingNoteId != null || isSyncingBatch) return
        val activeConfig = config
        if (!activeConfig.isConfigured()) {
            statusBanner = StatusBanner(
                "أضف رمز GitHub في الإعدادات أولاً للمزامنة",
                BannerTone.INFO
            )
            return
        }

        syncingNoteId = noteId
        scope.launch {
            try {
                val outcome = withContext(Dispatchers.IO) {
                    queueManager.syncSingle(noteId, activeConfig)
                }
                notes = withContext(Dispatchers.IO) { queueManager.getAllNotes() }
                statusBanner = when (outcome) {
                    is SingleSyncOutcome.Synced -> StatusBanner("تمت مزامنة الملاحظة ✓", BannerTone.SUCCESS)
                    is SingleSyncOutcome.AlreadySynced -> StatusBanner("الملاحظة متزامنة بالفعل ✓", BannerTone.SUCCESS)
                    is SingleSyncOutcome.NoToken -> StatusBanner(
                        "أضف رمز GitHub في الإعدادات أولاً للمزامنة",
                        BannerTone.INFO
                    )
                    is SingleSyncOutcome.Failed -> StatusBanner(outcome.errorMessage, BannerTone.PENDING)
                    is SingleSyncOutcome.NotFound -> null
                }
            } finally {
                syncingNoteId = null
            }
        }
    }

    fun syncAllPending(silent: Boolean = false) {
        if (isSyncingBatch) return
        val activeConfig = config
        if (!activeConfig.isConfigured()) {
            if (!silent) {
                statusBanner = StatusBanner(
                    "أضف رمز GitHub في الإعدادات أولاً للمزامنة",
                    BannerTone.INFO
                )
            }
            return
        }

        isSyncingBatch = true
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    queueManager.syncAllPending(activeConfig)
                }
                notes = withContext(Dispatchers.IO) { queueManager.getAllNotes() }
                if (!silent || result.syncedCount > 0) {
                    statusBanner = when {
                        result.attemptedCount == 0 -> if (!silent) {
                            StatusBanner("لا توجد ملاحظات معلّقة للمزامنة ✓", BannerTone.SUCCESS)
                        } else {
                            statusBanner
                        }
                        result.failedCount == 0 -> StatusBanner(
                            String.format(Locale.US, "تمت مزامنة %d ملاحظة بنجاح ✓", result.syncedCount),
                            BannerTone.SUCCESS
                        )
                        result.syncedCount > 0 -> StatusBanner(
                            String.format(
                                Locale.US,
                                "تمت مزامنة %d وبقيت %d بانتظار الاتصال",
                                result.syncedCount,
                                result.failedCount
                            ),
                            BannerTone.PENDING
                        )
                        else -> StatusBanner(
                            result.lastError ?: "تعذر الاتصال — ما زالت الملاحظات محفوظة محلياً",
                            BannerTone.PENDING
                        )
                    }
                }
            } finally {
                isSyncingBatch = false
            }
        }
    }

    fun deleteNote(noteId: Long) {
        scope.launch {
            withContext(Dispatchers.IO) { queueManager.deleteNote(noteId) }
            notes = withContext(Dispatchers.IO) { queueManager.getAllNotes() }
            statusBanner = StatusBanner("تم حذف السجل محلياً", BannerTone.INFO)
        }
    }

    fun saveSettings(updated: GitHubConfig) {
        val clean = updated.normalized().let {
            it.copy(
                owner = it.owner.ifEmpty { GitHubConfig.DEFAULT_OWNER },
                repo = it.repo.ifEmpty { GitHubConfig.DEFAULT_REPO },
                branch = it.branch.ifEmpty { GitHubConfig.DEFAULT_BRANCH },
                filePath = it.filePath.ifEmpty { GitHubConfig.DEFAULT_FILE_PATH }
            )
        }
        settingsStore.saveConfig(clean)
        config = clean
        connectionBanner = StatusBanner("تم حفظ الإعدادات بأمان عبر التشفير المحلي ✓", BannerTone.SUCCESS)
    }

    fun testAndSaveConnection(candidate: GitHubConfig) {
        if (isTestingConnection) return
        val clean = candidate.normalized().let {
            it.copy(
                owner = it.owner.ifEmpty { GitHubConfig.DEFAULT_OWNER },
                repo = it.repo.ifEmpty { GitHubConfig.DEFAULT_REPO },
                branch = it.branch.ifEmpty { GitHubConfig.DEFAULT_BRANCH },
                filePath = it.filePath.ifEmpty { GitHubConfig.DEFAULT_FILE_PATH }
            )
        }
        settingsStore.saveConfig(clean)
        config = clean

        isTestingConnection = true
        connectionBanner = StatusBanner("جارٍ اختبار الاتصال بمستودع GitHub...", BannerTone.INFO)

        scope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    syncGateway.testConnection(clean)
                }
                connectionBanner = when (res) {
                    is ConnectionTestResult.Success -> StatusBanner(res.message, BannerTone.SUCCESS)
                    is ConnectionTestResult.Warning -> StatusBanner(res.message, BannerTone.PENDING)
                    is ConnectionTestResult.Failure -> StatusBanner(res.message, BannerTone.ERROR)
                }
            } finally {
                isTestingConnection = false
            }
        }
    }
}

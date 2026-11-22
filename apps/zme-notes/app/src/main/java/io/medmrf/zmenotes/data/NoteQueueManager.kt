package io.medmrf.zmenotes.data

import io.medmrf.zmenotes.model.GitHubConfig
import io.medmrf.zmenotes.model.NoteCategories
import io.medmrf.zmenotes.model.NoteRecord
import io.medmrf.zmenotes.model.SyncStatus
import io.medmrf.zmenotes.model.TimestampFormatter
import io.medmrf.zmenotes.sync.NoteSyncGateway
import io.medmrf.zmenotes.sync.SyncResult
import java.time.ZoneId
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed class CaptureOutcome {
    data class Synced(val note: NoteRecord, val userMessage: String = "تم الإرسال والمزامنة ✓") : CaptureOutcome()
    data class SavedPendingOffline(
        val note: NoteRecord,
        val userMessage: String,
        val detailError: String?
    ) : CaptureOutcome()
    data class SavedNoToken(
        val note: NoteRecord,
        val userMessage: String = "حُفظ محلياً — أضف رمز GitHub في الإعدادات للمزامنة"
    ) : CaptureOutcome()
}

sealed class SingleSyncOutcome {
    data class Synced(val note: NoteRecord) : SingleSyncOutcome()
    data object AlreadySynced : SingleSyncOutcome()
    data object NotFound : SingleSyncOutcome()
    data object NoToken : SingleSyncOutcome()
    data class Failed(val errorMessage: String) : SingleSyncOutcome()
}

data class BatchSyncOutcome(
    val attemptedCount: Int,
    val syncedCount: Int,
    val failedCount: Int,
    val skippedNoToken: Boolean = false,
    val lastError: String? = null
)

class NoteQueueManager(
    private val store: NoteStore,
    private val syncGateway: NoteSyncGateway,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val zoneId: ZoneId = ZoneId.systemDefault()
) {
    private val syncMutex = Mutex()

    suspend fun captureAndTrySync(
        rawContent: String,
        category: String?,
        intensity: Int?,
        config: GitHubConfig
    ): CaptureOutcome {
        val trimmed = rawContent.trim()
        require(trimmed.isNotEmpty()) { "Note content must not be blank" }

        val now = clock()
        val chosenCategory = category?.trim()?.ifEmpty { NoteCategories.DEFAULT } ?: NoteCategories.DEFAULT
        val validIntensity = intensity?.takeIf { it in 1..5 }

        // Always persist locally FIRST before any network attempt.
        val saved = store.insert(
            NoteRecord(
                content = trimmed,
                category = chosenCategory,
                intensity = validIntensity,
                createdAtEpochMs = now,
                formattedDate = TimestampFormatter.formatDate(now, zoneId),
                formattedTime = TimestampFormatter.formatTime(now, zoneId),
                syncStatus = SyncStatus.PENDING
            )
        )

        val normalizedConfig = config.normalized()
        if (!normalizedConfig.isConfigured()) {
            return CaptureOutcome.SavedNoToken(saved)
        }

        return syncMutex.withLock {
            when (val res = syncGateway.pushNote(normalizedConfig, saved)) {
                is SyncResult.Success -> {
                    val syncedAt = clock()
                    store.markSynced(saved.id, syncedAt, res.commitSha)
                    val updated = store.getById(saved.id) ?: saved.copy(
                        syncStatus = SyncStatus.SYNCED,
                        syncedAtEpochMs = syncedAt,
                        remoteCommitSha = res.commitSha,
                        lastError = null
                    )
                    CaptureOutcome.Synced(updated)
                }
                is SyncResult.Failure -> {
                    store.markPendingWithError(saved.id, res.message)
                    val updated = store.getById(saved.id) ?: saved.copy(lastError = res.message)
                    val banner = if (res.isNetworkError) {
                        "محفوظ محلياً — بانتظار الاتصال"
                    } else {
                        "محفوظ محلياً — ${res.message}"
                    }
                    CaptureOutcome.SavedPendingOffline(
                        note = updated,
                        userMessage = banner,
                        detailError = res.message
                    )
                }
            }
        }
    }

    suspend fun syncSingle(noteId: Long, config: GitHubConfig): SingleSyncOutcome {
        val normalizedConfig = config.normalized()
        if (!normalizedConfig.isConfigured()) {
            return SingleSyncOutcome.NoToken
        }

        return syncMutex.withLock {
            val current = store.getById(noteId) ?: return@withLock SingleSyncOutcome.NotFound
            if (current.syncStatus == SyncStatus.SYNCED) {
                return@withLock SingleSyncOutcome.AlreadySynced
            }
            when (val res = syncGateway.pushNote(normalizedConfig, current)) {
                is SyncResult.Success -> {
                    val syncedAt = clock()
                    store.markSynced(current.id, syncedAt, res.commitSha)
                    val updated = store.getById(current.id) ?: current.copy(
                        syncStatus = SyncStatus.SYNCED,
                        syncedAtEpochMs = syncedAt,
                        remoteCommitSha = res.commitSha,
                        lastError = null
                    )
                    SingleSyncOutcome.Synced(updated)
                }
                is SyncResult.Failure -> {
                    store.markPendingWithError(current.id, res.message)
                    SingleSyncOutcome.Failed(res.message)
                }
            }
        }
    }

    suspend fun syncAllPending(config: GitHubConfig): BatchSyncOutcome {
        val normalizedConfig = config.normalized()
        if (!normalizedConfig.isConfigured()) {
            return BatchSyncOutcome(
                attemptedCount = 0,
                syncedCount = 0,
                failedCount = 0,
                skippedNoToken = true
            )
        }

        return syncMutex.withLock {
            val pending = store.getPendingOldestFirst()
            if (pending.isEmpty()) {
                return@withLock BatchSyncOutcome(attemptedCount = 0, syncedCount = 0, failedCount = 0)
            }

            var synced = 0
            var failed = 0
            var lastError: String? = null

            for (note in pending) {
                val latest = store.getById(note.id) ?: continue
                if (latest.syncStatus == SyncStatus.SYNCED) continue

                when (val res = syncGateway.pushNote(normalizedConfig, latest)) {
                    is SyncResult.Success -> {
                        store.markSynced(latest.id, clock(), res.commitSha)
                        synced++
                    }
                    is SyncResult.Failure -> {
                        store.markPendingWithError(latest.id, res.message)
                        failed++
                        lastError = res.message
                        if (res.isNetworkError || res.isAuthError) {
                            break
                        }
                    }
                }
            }

            BatchSyncOutcome(
                attemptedCount = synced + failed,
                syncedCount = synced,
                failedCount = failed,
                lastError = lastError
            )
        }
    }

    fun getAllNotes(): List<NoteRecord> = store.getAll()

    fun deleteNote(id: Long) = store.delete(id)
}

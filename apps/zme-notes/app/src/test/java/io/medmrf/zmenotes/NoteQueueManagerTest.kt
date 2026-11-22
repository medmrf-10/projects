package io.medmrf.zmenotes

import io.medmrf.zmenotes.data.CaptureOutcome
import io.medmrf.zmenotes.data.NoteQueueManager
import io.medmrf.zmenotes.data.NoteStore
import io.medmrf.zmenotes.data.SingleSyncOutcome
import io.medmrf.zmenotes.model.GitHubConfig
import io.medmrf.zmenotes.model.NoteRecord
import io.medmrf.zmenotes.model.SyncStatus
import io.medmrf.zmenotes.sync.ConnectionTestResult
import io.medmrf.zmenotes.sync.NoteSyncGateway
import io.medmrf.zmenotes.sync.SyncResult
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NoteQueueManagerTest {

    private class InMemoryNoteStore : NoteStore {
        private var nextId = 1L
        private val items = linkedMapOf<Long, NoteRecord>()

        override fun insert(note: NoteRecord): NoteRecord {
            val saved = note.copy(id = nextId++)
            items[saved.id] = saved
            return saved
        }

        override fun getAll(): List<NoteRecord> =
            items.values.sortedWith(compareByDescending<NoteRecord> { it.createdAtEpochMs }.thenByDescending { it.id })

        override fun getPendingOldestFirst(): List<NoteRecord> =
            items.values
                .filter { it.syncStatus == SyncStatus.PENDING }
                .sortedWith(compareBy<NoteRecord> { it.createdAtEpochMs }.thenBy { it.id })

        override fun getById(id: Long): NoteRecord? = items[id]

        override fun markSynced(id: Long, syncedAtEpochMs: Long, commitSha: String?) {
            items[id]?.let {
                items[id] = it.copy(
                    syncStatus = SyncStatus.SYNCED,
                    lastError = null,
                    syncedAtEpochMs = syncedAtEpochMs,
                    remoteCommitSha = commitSha
                )
            }
        }

        override fun markPendingWithError(id: Long, errorMessage: String?) {
            items[id]?.let {
                items[id] = it.copy(
                    syncStatus = SyncStatus.PENDING,
                    lastError = errorMessage
                )
            }
        }

        override fun delete(id: Long) {
            items.remove(id)
        }
    }

    private class FakeSyncGateway(
        var pushBehavior: (NoteRecord) -> SyncResult
    ) : NoteSyncGateway {
        val pushedIds = mutableListOf<Long>()
        override fun testConnection(config: GitHubConfig): ConnectionTestResult =
            ConnectionTestResult.Success("ok")

        override fun pushNote(config: GitHubConfig, note: NoteRecord): SyncResult {
            pushedIds.add(note.id)
            return pushBehavior(note)
        }
    }

    private val unconfigured = GitHubConfig(token = "")
    private val configured = GitHubConfig(token = "unit_test_pat_placeholder")

    @Test
    fun captureWithoutTokenSavesLocallyAsPendingAndSkipsNetwork() = runBlocking {
        val store = InMemoryNoteStore()
        val gateway = FakeSyncGateway { error("Should not call network without token") }
        val manager = NoteQueueManager(store, gateway, clock = { 1_763_793_600_000L }, zoneId = ZoneOffset.UTC)

        val outcome = manager.captureAndTrySync(
            rawContent = "تدوينة قبل إعداد الرمز",
            category = "عادة ورغبة",
            intensity = 2,
            config = unconfigured
        )

        assertTrue(outcome is CaptureOutcome.SavedNoToken)
        assertEquals(
            "حُفظ محلياً — أضف رمز GitHub في الإعدادات للمزامنة",
            (outcome as CaptureOutcome.SavedNoToken).userMessage
        )
        assertEquals(1, store.getAll().size)
        assertEquals(SyncStatus.PENDING, store.getAll().first().syncStatus)
        assertTrue(gateway.pushedIds.isEmpty())
    }

    @Test
    fun captureOfflinePersistsFirstThenTransitionsToSyncedWhenBackOnline() = runBlocking {
        val store = InMemoryNoteStore()
        var online = false
        val gateway = FakeSyncGateway { note ->
            if (online) {
                SyncResult.Success(commitSha = "sha_${note.id}", sequenceNumber = note.id.toInt())
            } else {
                SyncResult.Failure("انقطع الاتصال", isNetworkError = true)
            }
        }
        var now = 1_763_793_600_000L
        val manager = NoteQueueManager(store, gateway, clock = { now }, zoneId = ZoneOffset.UTC)

        val first = manager.captureAndTrySync("ملاحظة أولى بلا إنترنت", "نوم وطاقة", 3, configured)
        assertTrue(first is CaptureOutcome.SavedPendingOffline)
        val firstPending = first as CaptureOutcome.SavedPendingOffline
        assertEquals("محفوظ محلياً — بانتظار الاتصال", firstPending.userMessage)

        now += 60_000L
        val second = manager.captureAndTrySync("ملاحظة ثانية بلا إنترنت", null, null, configured)
        assertTrue(second is CaptureOutcome.SavedPendingOffline)
        val secondPending = second as CaptureOutcome.SavedPendingOffline
        assertEquals(2, store.getPendingOldestFirst().size)

        // Network returns -> batch sync flushes oldest-first
        online = true
        gateway.pushedIds.clear()
        val batch = manager.syncAllPending(configured)
        assertEquals(2, batch.attemptedCount)
        assertEquals(2, batch.syncedCount)
        assertEquals(0, batch.failedCount)
        assertEquals(listOf(firstPending.note.id, secondPending.note.id), gateway.pushedIds)
        assertTrue(store.getPendingOldestFirst().isEmpty())

        val persistedFirst = store.getById(firstPending.note.id)!!
        assertEquals(SyncStatus.SYNCED, persistedFirst.syncStatus)
        assertNull(persistedFirst.lastError)
        assertNotNull(persistedFirst.syncedAtEpochMs)
        assertEquals("sha_${firstPending.note.id}", persistedFirst.remoteCommitSha)
    }

    @Test
    fun singleSyncAndDeleteTransitionsAreIdempotent() = runBlocking {
        val store = InMemoryNoteStore()
        val gateway = FakeSyncGateway { note ->
            SyncResult.Success(commitSha = "commit_${note.id}", sequenceNumber = 1)
        }
        val manager = NoteQueueManager(store, gateway, clock = { 1_763_793_600_000L }, zoneId = ZoneOffset.UTC)

        val saved = (manager.captureAndTrySync("ملاحظة معلقة", "تفكير وتركيز", 4, unconfigured) as CaptureOutcome.SavedNoToken).note
        assertEquals(SyncStatus.PENDING, saved.syncStatus)

        val firstRetry = manager.syncSingle(saved.id, configured)
        assertTrue(firstRetry is SingleSyncOutcome.Synced)
        assertEquals(1, gateway.pushedIds.size)

        val secondRetry = manager.syncSingle(saved.id, configured)
        assertTrue(secondRetry is SingleSyncOutcome.AlreadySynced)
        assertEquals(1, gateway.pushedIds.size)

        manager.deleteNote(saved.id)
        assertTrue(manager.getAllNotes().isEmpty())
    }
}

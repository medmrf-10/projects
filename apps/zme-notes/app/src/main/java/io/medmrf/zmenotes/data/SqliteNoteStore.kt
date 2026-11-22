package io.medmrf.zmenotes.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import io.medmrf.zmenotes.model.NoteRecord
import io.medmrf.zmenotes.model.SyncStatus

class SqliteNoteStore(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION),
    NoteStore {

    init {
        setWriteAheadLoggingEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE $TABLE_NOTES (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_CONTENT TEXT NOT NULL,
                $COL_CATEGORY TEXT NOT NULL,
                $COL_INTENSITY INTEGER,
                $COL_CREATED_AT INTEGER NOT NULL,
                $COL_DATE TEXT NOT NULL,
                $COL_TIME TEXT NOT NULL,
                $COL_SYNC_STATUS TEXT NOT NULL,
                $COL_LAST_ERROR TEXT,
                $COL_SYNCED_AT INTEGER,
                $COL_COMMIT_SHA TEXT
            )
            """.trimIndent()
        )
        db.execSQL(
            "CREATE INDEX idx_notes_status_created ON $TABLE_NOTES ($COL_SYNC_STATUS, $COL_CREATED_AT)"
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // v1 initial schema
    }

    @Synchronized
    override fun insert(note: NoteRecord): NoteRecord {
        val values = ContentValues().apply {
            put(COL_CONTENT, note.content)
            put(COL_CATEGORY, note.category)
            if (note.intensity != null) put(COL_INTENSITY, note.intensity) else putNull(COL_INTENSITY)
            put(COL_CREATED_AT, note.createdAtEpochMs)
            put(COL_DATE, note.formattedDate)
            put(COL_TIME, note.formattedTime)
            put(COL_SYNC_STATUS, note.syncStatus.name)
            put(COL_LAST_ERROR, note.lastError)
            if (note.syncedAtEpochMs != null) put(COL_SYNCED_AT, note.syncedAtEpochMs) else putNull(COL_SYNCED_AT)
            put(COL_COMMIT_SHA, note.remoteCommitSha)
        }
        val id = writableDatabase.insertOrThrow(TABLE_NOTES, null, values)
        return note.copy(id = id)
    }

    @Synchronized
    override fun getAll(): List<NoteRecord> {
        val result = mutableListOf<NoteRecord>()
        readableDatabase.query(
            TABLE_NOTES,
            null,
            null,
            null,
            null,
            null,
            "$COL_CREATED_AT DESC, $COL_ID DESC"
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result.add(cursor.toNoteRecord())
            }
        }
        return result
    }

    @Synchronized
    override fun getPendingOldestFirst(): List<NoteRecord> {
        val result = mutableListOf<NoteRecord>()
        readableDatabase.query(
            TABLE_NOTES,
            null,
            "$COL_SYNC_STATUS = ?",
            arrayOf(SyncStatus.PENDING.name),
            null,
            null,
            "$COL_CREATED_AT ASC, $COL_ID ASC"
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result.add(cursor.toNoteRecord())
            }
        }
        return result
    }

    @Synchronized
    override fun getById(id: Long): NoteRecord? {
        readableDatabase.query(
            TABLE_NOTES,
            null,
            "$COL_ID = ?",
            arrayOf(id.toString()),
            null,
            null,
            null
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.toNoteRecord() else null
        }
    }

    @Synchronized
    override fun markSynced(id: Long, syncedAtEpochMs: Long, commitSha: String?) {
        val values = ContentValues().apply {
            put(COL_SYNC_STATUS, SyncStatus.SYNCED.name)
            putNull(COL_LAST_ERROR)
            put(COL_SYNCED_AT, syncedAtEpochMs)
            put(COL_COMMIT_SHA, commitSha)
        }
        writableDatabase.update(TABLE_NOTES, values, "$COL_ID = ?", arrayOf(id.toString()))
    }

    @Synchronized
    override fun markPendingWithError(id: Long, errorMessage: String?) {
        val values = ContentValues().apply {
            put(COL_SYNC_STATUS, SyncStatus.PENDING.name)
            put(COL_LAST_ERROR, errorMessage)
        }
        writableDatabase.update(TABLE_NOTES, values, "$COL_ID = ?", arrayOf(id.toString()))
    }

    @Synchronized
    override fun delete(id: Long) {
        writableDatabase.delete(TABLE_NOTES, "$COL_ID = ?", arrayOf(id.toString()))
    }

    private fun Cursor.toNoteRecord(): NoteRecord {
        val intensityIdx = getColumnIndexOrThrow(COL_INTENSITY)
        val syncedAtIdx = getColumnIndexOrThrow(COL_SYNCED_AT)
        val statusName = getString(getColumnIndexOrThrow(COL_SYNC_STATUS))
        val status = runCatching { SyncStatus.valueOf(statusName) }.getOrDefault(SyncStatus.PENDING)
        return NoteRecord(
            id = getLong(getColumnIndexOrThrow(COL_ID)),
            content = getString(getColumnIndexOrThrow(COL_CONTENT)),
            category = getString(getColumnIndexOrThrow(COL_CATEGORY)),
            intensity = if (isNull(intensityIdx)) null else getInt(intensityIdx),
            createdAtEpochMs = getLong(getColumnIndexOrThrow(COL_CREATED_AT)),
            formattedDate = getString(getColumnIndexOrThrow(COL_DATE)),
            formattedTime = getString(getColumnIndexOrThrow(COL_TIME)),
            syncStatus = status,
            lastError = getString(getColumnIndexOrThrow(COL_LAST_ERROR)),
            syncedAtEpochMs = if (isNull(syncedAtIdx)) null else getLong(syncedAtIdx),
            remoteCommitSha = getString(getColumnIndexOrThrow(COL_COMMIT_SHA))
        )
    }

    companion object {
        private const val DB_NAME = "zme_notes.db"
        private const val DB_VERSION = 1
        private const val TABLE_NOTES = "notes"

        private const val COL_ID = "id"
        private const val COL_CONTENT = "content"
        private const val COL_CATEGORY = "category"
        private const val COL_INTENSITY = "intensity"
        private const val COL_CREATED_AT = "created_at_ms"
        private const val COL_DATE = "formatted_date"
        private const val COL_TIME = "formatted_time"
        private const val COL_SYNC_STATUS = "sync_status"
        private const val COL_LAST_ERROR = "last_error"
        private const val COL_SYNCED_AT = "synced_at_ms"
        private const val COL_COMMIT_SHA = "remote_commit_sha"
    }
}

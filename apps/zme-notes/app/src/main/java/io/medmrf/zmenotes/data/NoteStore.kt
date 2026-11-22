package io.medmrf.zmenotes.data

import io.medmrf.zmenotes.model.NoteRecord

interface NoteStore {
    fun insert(note: NoteRecord): NoteRecord
    fun getAll(): List<NoteRecord>
    fun getPendingOldestFirst(): List<NoteRecord>
    fun getById(id: Long): NoteRecord?
    fun markSynced(id: Long, syncedAtEpochMs: Long, commitSha: String?)
    fun markPendingWithError(id: Long, errorMessage: String?)
    fun delete(id: Long)
}

package com.tickflow.app.core.repository

import com.tickflow.app.core.database.FolderDao
import com.tickflow.app.core.database.FolderEntity
import com.tickflow.app.core.database.ListDao
import com.tickflow.app.core.database.ListEntity
import com.tickflow.app.core.database.TagDao
import com.tickflow.app.core.database.TagEntity
import com.tickflow.app.core.database.TombstoneDao
import com.tickflow.app.core.database.TombstoneEntity
import com.tickflow.app.core.sync.SyncScheduler
import com.tickflow.app.core.util.TimeUtils
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrgRepository @Inject constructor(
    private val listDao: ListDao,
    private val folderDao: FolderDao,
    private val tagDao: TagDao,
    private val tombstoneDao: TombstoneDao,
    private val syncScheduler: SyncScheduler,
) {
    fun observeLists(): Flow<List<ListEntity>> = listDao.observeAll()
    fun observeInbox(): Flow<ListEntity?> = listDao.observeInbox()
    fun observeFolders(): Flow<List<FolderEntity>> = folderDao.observeAll()
    fun observeTags(): Flow<List<TagEntity>> = tagDao.observeAll()

    suspend fun getInboxId(): String? = listDao.getInbox()?.id

    suspend fun createList(name: String, folderId: String? = null): String {
        val id = UUID.randomUUID().toString()
        val entity = ListEntity(
            id = id,
            folderId = folderId,
            name = name.trim(),
            color = null,
            icon = null,
            isInbox = false,
            isArchived = false,
            sortOrder = (listDao.maxSortOrder() ?: 0L) + 1024,
            updatedAt = TimeUtils.nowIso(),
            seq = 0,
            dirty = true,
            deletedPending = false,
        )
        listDao.upsert(entity)
        syncScheduler.requestImmediate()
        return id
    }

    suspend fun createFolder(name: String): String {
        val id = UUID.randomUUID().toString()
        folderDao.upsert(
            FolderEntity(
                id = id,
                name = name.trim(),
                color = null,
                sortOrder = (folderDao.maxSortOrder() ?: 0L) + 1024,
                updatedAt = TimeUtils.nowIso(),
                seq = 0,
                dirty = true,
                deletedPending = false,
            )
        )
        syncScheduler.requestImmediate()
        return id
    }

    suspend fun createTag(name: String): String {
        val id = UUID.randomUUID().toString()
        tagDao.upsert(
            TagEntity(
                id = id,
                name = name.trim(),
                color = null,
                sortOrder = (tagDao.maxSortOrder() ?: 0L) + 1024,
                updatedAt = TimeUtils.nowIso(),
                seq = 0,
                dirty = true,
                deletedPending = false,
            )
        )
        syncScheduler.requestImmediate()
        return id
    }

    suspend fun deleteList(id: String) = deleteWithTombstone("list", id)
    suspend fun deleteFolder(id: String) = deleteWithTombstone("folder", id)
    suspend fun deleteTag(id: String) = deleteWithTombstone("tag", id)

    private suspend fun deleteWithTombstone(type: String, id: String) {
        val now = TimeUtils.nowIso()
        when (type) {
            "list" -> listDao.markDeleted(id, now)
            "folder" -> folderDao.markDeleted(id, now)
            "tag" -> tagDao.markDeleted(id, now)
        }
        tombstoneDao.insert(TombstoneEntity(type, id))
        syncScheduler.requestImmediate()
    }
}
package com.tickflow.app.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 ORDER BY sortOrder ASC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND status = 0 ORDER BY sortOrder ASC")
    fun observeActive(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND listId = :listId ORDER BY sortOrder ASC")
    fun observeByList(listId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND status = 0 AND listId = :listId ORDER BY sortOrder ASC")
    fun observeInbox(listId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND status = 0 AND parentId IS NULL AND COALESCE(nextDueDate, dueDate) IS NOT NULL AND COALESCE(nextDueDate, dueDate) < :beforeIso ORDER BY COALESCE(nextDueDate, dueDate) ASC")
    fun observeToday(beforeIso: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND status = 0 AND parentId IS NULL AND COALESCE(nextDueDate, dueDate) IS NOT NULL AND COALESCE(nextDueDate, dueDate) >= :fromIso AND COALESCE(nextDueDate, dueDate) < :toIso ORDER BY COALESCE(nextDueDate, dueDate) ASC")
    fun observeRange(fromIso: String, toIso: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND status = 2 ORDER BY completedAt DESC LIMIT 200")
    fun observeCompleted(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND parentId = :parentId ORDER BY sortOrder ASC")
    fun observeSubtasks(parentId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id")
    fun observeById(id: String): Flow<TaskEntity?>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun getById(id: String): TaskEntity?

    @Query("SELECT * FROM tasks WHERE parentId = :parentId AND deletedPending = 0")
    suspend fun subtasks(parentId: String): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE deletedPending = 0")
    suspend fun getAll(): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE dirty = 1")
    suspend fun dirty(): List<TaskEntity>

    /** 提醒候选：未完成 + 有有效到期 + reminders 非空。 */
    @Query("SELECT * FROM tasks WHERE deletedPending = 0 AND status = 0 AND reminders IS NOT NULL AND COALESCE(nextDueDate, dueDate) IS NOT NULL")
    suspend fun reminderCandidates(): List<TaskEntity>

    @Query("SELECT parentId AS parentId, COUNT(*) AS cnt FROM tasks WHERE parentId IS NOT NULL AND deletedPending = 0 GROUP BY parentId")
    fun observeSubtaskCounts(): Flow<List<SubtaskCount>>

    @Query("SELECT COUNT(*) FROM tasks WHERE deletedPending = 0 AND status = 0 AND listId = :listId")
    fun countActiveInList(listId: String): Flow<Int>

    @Query("SELECT MAX(sortOrder) FROM tasks WHERE listId = :listId")
    suspend fun maxSortOrder(listId: String?): Long?

    @Query("DELETE FROM tasks WHERE id = :id AND dirty = 0")
    suspend fun deleteIfNotDirty(id: String)

    @Upsert
    suspend fun upsert(task: TaskEntity)

    @Upsert
    suspend fun upsertAll(tasks: List<TaskEntity>)

    @Query("UPDATE tasks SET status = :status, completedAt = :completedAt, updatedAt = :updatedAt, dirty = 1 WHERE id = :id")
    suspend fun setStatus(id: String, status: Int, completedAt: String?, updatedAt: String)

    @Query("UPDATE tasks SET listId = :listId, updatedAt = :updatedAt, dirty = 1 WHERE id = :id")
    suspend fun setList(id: String, listId: String?, updatedAt: String)

    @Query("UPDATE tasks SET deletedPending = 1, dirty = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markDeleted(id: String, updatedAt: String)

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM tasks WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM tasks WHERE dirty = 0")
    suspend fun deleteNonDirty()

    @Query("DELETE FROM tasks WHERE deletedPending = 1")
    suspend fun deletePending()

    @Query("UPDATE tasks SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirtyIfUnchanged(id: String, updatedAt: String)
}

@Dao
interface ListDao {

    @Query("SELECT * FROM lists WHERE deletedPending = 0 ORDER BY sortOrder ASC")
    fun observeAll(): Flow<List<ListEntity>>

    @Query("SELECT * FROM lists WHERE deletedPending = 0 AND isInbox = 1 LIMIT 1")
    fun observeInbox(): Flow<ListEntity?>

    @Query("SELECT * FROM lists WHERE id = :id")
    suspend fun getById(id: String): ListEntity?

    @Query("SELECT * FROM lists WHERE isInbox = 1 AND deletedPending = 0 LIMIT 1")
    suspend fun getInbox(): ListEntity?

    @Query("SELECT * FROM lists WHERE deletedPending = 0")
    suspend fun all(): List<ListEntity>

    @Query("SELECT * FROM lists WHERE dirty = 1")
    suspend fun dirty(): List<ListEntity>

    @Query("SELECT MAX(sortOrder) FROM lists")
    suspend fun maxSortOrder(): Long?

    @Query("DELETE FROM lists WHERE id = :id AND dirty = 0")
    suspend fun deleteIfNotDirty(id: String)

    @Upsert
    suspend fun upsert(list: ListEntity)

    @Upsert
    suspend fun upsertAll(lists: List<ListEntity>)

    @Query("UPDATE lists SET deletedPending = 1, dirty = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markDeleted(id: String, updatedAt: String)

    @Query("DELETE FROM lists WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM lists WHERE dirty = 0")
    suspend fun deleteNonDirty()

    @Query("DELETE FROM lists WHERE deletedPending = 1")
    suspend fun deletePending()

    @Query("UPDATE lists SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirtyIfUnchanged(id: String, updatedAt: String)
}

@Dao
interface FolderDao {

    @Query("SELECT * FROM folders WHERE deletedPending = 0 ORDER BY sortOrder ASC")
    fun observeAll(): Flow<List<FolderEntity>>

    @Query("SELECT * FROM folders WHERE dirty = 1")
    suspend fun dirty(): List<FolderEntity>

    @Query("SELECT MAX(sortOrder) FROM folders")
    suspend fun maxSortOrder(): Long?

    @Query("DELETE FROM folders WHERE id = :id AND dirty = 0")
    suspend fun deleteIfNotDirty(id: String)

    @Upsert
    suspend fun upsertAll(folders: List<FolderEntity>)

    @Upsert
    suspend fun upsert(folder: FolderEntity)

    @Query("UPDATE folders SET deletedPending = 1, dirty = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markDeleted(id: String, updatedAt: String)

    @Query("DELETE FROM folders WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM folders WHERE dirty = 0")
    suspend fun deleteNonDirty()

    @Query("DELETE FROM folders WHERE deletedPending = 1")
    suspend fun deletePending()

    @Query("UPDATE folders SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirtyIfUnchanged(id: String, updatedAt: String)
}

@Dao
interface TagDao {

    @Query("SELECT * FROM tags WHERE deletedPending = 0 ORDER BY sortOrder ASC")
    fun observeAll(): Flow<List<TagEntity>>

    @Query("SELECT * FROM tags WHERE deletedPending = 0 ORDER BY sortOrder ASC")
    suspend fun active(): List<TagEntity>

    @Query("SELECT * FROM tags WHERE dirty = 1")
    suspend fun dirty(): List<TagEntity>

    @Query("SELECT MAX(sortOrder) FROM tags")
    suspend fun maxSortOrder(): Long?

    @Query("DELETE FROM tags WHERE id = :id AND dirty = 0")
    suspend fun deleteIfNotDirty(id: String)

    @Upsert
    suspend fun upsertAll(tags: List<TagEntity>)

    @Upsert
    suspend fun upsert(tag: TagEntity)

    @Query("UPDATE tags SET deletedPending = 1, dirty = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markDeleted(id: String, updatedAt: String)

    @Query("DELETE FROM tags WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM tags WHERE dirty = 0")
    suspend fun deleteNonDirty()

    @Query("DELETE FROM tags WHERE deletedPending = 1")
    suspend fun deletePending()

    @Query("UPDATE tags SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirtyIfUnchanged(id: String, updatedAt: String)
}

@Dao
interface HabitDao {

    @Query("SELECT * FROM habits WHERE deletedPending = 0 ORDER BY sortOrder ASC")
    fun observeAll(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE dirty = 1")
    suspend fun dirty(): List<HabitEntity>

    @Query("DELETE FROM habits WHERE id = :id AND dirty = 0")
    suspend fun deleteIfNotDirty(id: String)

    @Upsert
    suspend fun upsertAll(habits: List<HabitEntity>)

    @Query("UPDATE habits SET deletedPending = 1, dirty = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markDeleted(id: String, updatedAt: String)

    @Query("DELETE FROM habits WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM habits WHERE dirty = 0")
    suspend fun deleteNonDirty()

    @Query("DELETE FROM habits WHERE deletedPending = 1")
    suspend fun deletePending()

    @Query("UPDATE habits SET dirty = 0 WHERE id = :id AND updatedAt = :updatedAt")
    suspend fun clearDirtyIfUnchanged(id: String, updatedAt: String)
}

@Dao
interface SettingsDao {

    @Query("SELECT * FROM settings LIMIT 1")
    fun observe(): Flow<SettingsEntity?>

    @Query("SELECT * FROM settings LIMIT 1")
    suspend fun get(): SettingsEntity?

    @Query("SELECT * FROM settings WHERE dirty = 1 LIMIT 1")
    suspend fun dirty(): SettingsEntity?

    @Upsert
    suspend fun upsert(settings: SettingsEntity)

    @Query("DELETE FROM settings WHERE dirty = 0")
    suspend fun deleteNonDirty()

    @Query("UPDATE settings SET dirty = 0 WHERE userId = :userId AND updatedAt = :updatedAt")
    suspend fun clearDirtyIfUnchanged(userId: String, updatedAt: String)
}

@Dao
interface TombstoneDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(tombstone: TombstoneEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tombstones: List<TombstoneEntity>)

    @Query("SELECT * FROM tombstones")
    suspend fun all(): List<TombstoneEntity>

    @Query("DELETE FROM tombstones WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM tombstones")
    suspend fun clear()
}

@Dao
interface ScheduledAlarmDao {

    @Query("SELECT * FROM scheduled_alarms")
    suspend fun all(): List<ScheduledAlarmEntity>

    @Query("SELECT * FROM scheduled_alarms ORDER BY triggerAt ASC LIMIT 1")
    suspend fun next(): ScheduledAlarmEntity?

    @Query("SELECT * FROM scheduled_alarms WHERE triggerAt <= :now ORDER BY triggerAt ASC")
    suspend fun due(now: Long): List<ScheduledAlarmEntity>

    @Upsert
    suspend fun upsertAll(alarms: List<ScheduledAlarmEntity>)

    @Query("DELETE FROM scheduled_alarms")
    suspend fun clear()
}
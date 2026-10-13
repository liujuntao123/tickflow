package com.tickflow.app.core.repository

import com.tickflow.app.core.database.ListDao
import com.tickflow.app.core.database.TaskDao
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.database.TombstoneDao
import com.tickflow.app.core.database.TombstoneEntity
import com.tickflow.app.core.sync.SyncScheduler
import com.tickflow.app.core.util.TimeUtils
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TaskRepository @Inject constructor(
    private val taskDao: TaskDao,
    private val listDao: ListDao,
    private val tombstoneDao: TombstoneDao,
    private val syncScheduler: SyncScheduler,
) {
    fun observeByList(listId: String): Flow<List<TaskEntity>> = taskDao.observeByList(listId)
    fun observeActive(): Flow<List<TaskEntity>> = taskDao.observeActive()
    fun observeInbox(inboxId: String): Flow<List<TaskEntity>> = taskDao.observeInbox(inboxId)
    fun observeCompleted(): Flow<List<TaskEntity>> = taskDao.observeCompleted()
    fun observeById(id: String): Flow<TaskEntity?> = taskDao.observeById(id)
    fun observeSubtasks(parentId: String): Flow<List<TaskEntity>> = taskDao.observeSubtasks(parentId)

    /** 今天（含已过期，未完成、有到期日）。 */
    fun observeToday(): Flow<List<TaskEntity>> = taskDao.observeToday(TimeUtils.endOfTodayIso())

    /** 未来 7 天（从今天日界起）。 */
    fun observeNext7(): Flow<List<TaskEntity>> {
        val from = TimeUtils.startOfTodayIso()
        return taskDao.observeRange(from, TimeUtils.plusDaysIso(from, 7))
    }

    suspend fun getById(id: String): TaskEntity? = taskDao.getById(id)

    suspend fun createTask(
        title: String,
        listId: String?,
        dueDate: String?,
        priority: Int,
        isAllDay: Boolean = false,
        notes: String? = null,
    ): String {
        val targetList = listId ?: listDao.getInbox()?.id
        val sortOrder = (taskDao.maxSortOrder(targetList) ?: 0L) + 1024
        val entity = TaskEntity(
            id = UUID.randomUUID().toString(),
            listId = targetList,
            parentId = null,
            title = title.trim(),
            notes = notes,
            priority = priority,
            status = 0,
            completedAt = null,
            dueDate = dueDate,
            isAllDay = isAllDay,
            startDate = null,
            timezone = null,
            recurrenceRule = null,
            recurrenceTz = null,
            recurrenceDtstart = null,
            recurrenceEnd = null,
            repeatFrom = 0,
            nextDueDate = null,
            reminders = null,
            reminderRepeatMinutes = null,
            checklist = null,
            sortOrder = sortOrder,
            tagIds = emptyList(),
            updatedAt = TimeUtils.nowIso(),
            seq = 0,
            dirty = true,
            deletedPending = false,
        )
        taskDao.upsert(entity)
        syncScheduler.requestImmediate()
        return entity.id
    }

    suspend fun createSubtask(parent: TaskEntity, title: String): String {
        val id = UUID.randomUUID().toString()
        val sub = parent.copy(
            id = id,
            parentId = parent.id,
            title = title.trim(),
            status = 0,
            completedAt = null,
            dueDate = null,
            isAllDay = false,
            checklist = null,
            recurrenceRule = null,
            tagIds = emptyList(),
            sortOrder = (taskDao.maxSortOrder(parent.listId) ?: 0L) + 1024,
            updatedAt = TimeUtils.nowIso(),
            seq = 0,
            dirty = true,
            deletedPending = false,
        )
        taskDao.upsert(sub)
        syncScheduler.requestImmediate()
        return id
    }

    suspend fun updateTask(task: TaskEntity) {
        taskDao.upsert(task.copy(updatedAt = TimeUtils.nowIso(), dirty = true, deletedPending = false))
        syncScheduler.requestImmediate()
    }

    suspend fun toggleComplete(task: TaskEntity) {
        val now = TimeUtils.nowIso()
        if (task.status == 2) {
            taskDao.setStatus(task.id, 0, null, now)
        } else {
            taskDao.setStatus(task.id, 2, now, now)
        }
        syncScheduler.requestImmediate()
    }

    suspend fun deleteTask(id: String) {
        val now = TimeUtils.nowIso()
        val subs = taskDao.subtasks(id)
        taskDao.markDeleted(id, now)
        tombstoneDao.insert(TombstoneEntity("task", id))
        subs.forEach { sub ->
            taskDao.markDeleted(sub.id, now)
            tombstoneDao.insert(TombstoneEntity("task", sub.id))
        }
        syncScheduler.requestImmediate()
    }
}
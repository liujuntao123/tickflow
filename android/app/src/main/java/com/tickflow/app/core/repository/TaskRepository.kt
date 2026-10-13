package com.tickflow.app.core.repository

import com.tickflow.app.core.database.ListDao
import com.tickflow.app.core.database.SubtaskCount
import com.tickflow.app.core.database.TaskDao
import com.tickflow.app.core.database.TaskEntity
import com.tickflow.app.core.database.TombstoneDao
import com.tickflow.app.core.database.TombstoneEntity
import com.tickflow.app.core.reminder.ReminderScheduler
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
    private val reminderScheduler: ReminderScheduler,
) {
    fun observeByList(listId: String): Flow<List<TaskEntity>> = taskDao.observeByList(listId)
    fun observeActive(): Flow<List<TaskEntity>> = taskDao.observeActive()
    fun observeInbox(inboxId: String): Flow<List<TaskEntity>> = taskDao.observeInbox(inboxId)
    fun observeCompleted(): Flow<List<TaskEntity>> = taskDao.observeCompleted()
    fun observeById(id: String): Flow<TaskEntity?> = taskDao.observeById(id)
    fun observeSubtasks(parentId: String): Flow<List<TaskEntity>> = taskDao.observeSubtasks(parentId)
    fun observeSubtaskCounts(): Flow<List<SubtaskCount>> = taskDao.observeSubtaskCounts()

    /** 今天（含已过期，未完成、有有效到期）。 */
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
        afterLocalChange()
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
            nextDueDate = null,
            reminders = null,
            tagIds = emptyList(),
            sortOrder = (taskDao.maxSortOrder(parent.listId) ?: 0L) + 1024,
            updatedAt = TimeUtils.nowIso(),
            seq = 0,
            dirty = true,
            deletedPending = false,
        )
        taskDao.upsert(sub)
        afterLocalChange()
        return id
    }

    suspend fun updateTask(task: TaskEntity) {
        taskDao.upsert(task.copy(updatedAt = TimeUtils.nowIso(), dirty = true, deletedPending = false))
        afterLocalChange()
    }

    /**
     * 勾选完成：仅推送原始完成态（status=2 + completedAt=now）并置 dirty 触发同步。
     * 重复任务的滚动由**服务端权威**处理（REST complete 与 /sync 推送共用同一实现），
     * 客户端只消费响应 delta 中回传的滚动结果（status=0 + 新 dueDate/nextDueDate）。
     */
    suspend fun toggleComplete(task: TaskEntity) {
        val now = TimeUtils.nowIso()
        val completed = task.status != 2
        taskDao.upsert(
            task.copy(
                status = if (completed) 2 else 0,
                completedAt = if (completed) now else null,
                updatedAt = now,
                dirty = true,
                deletedPending = false,
            )
        )
        afterLocalChange()
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
        afterLocalChange()
    }

    /** 本地任务集变化后：重算提醒 + 触发同步。 */
    private suspend fun afterLocalChange() {
        runCatching { reminderScheduler.rescheduleAll() }
        syncScheduler.requestImmediate()
    }
}
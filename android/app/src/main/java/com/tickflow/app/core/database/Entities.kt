package com.tickflow.app.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.tickflow.app.core.network.dto.ChecklistItemDto
import com.tickflow.app.core.network.dto.ReminderDto

/**
 * 与服务端可同步表镜像。
 * - dirty：本地待推送（本地写操作置 1，推送成功且未被再次修改后清 0）
 * - deletedPending：本地已删除待推送（配合 tombstones 表）
 * - updatedAt：客户端逻辑时间（UTC ISO 字符串），作为 LWW 依据随 /sync 上行
 * - seq：服务端单调序号（BigInt 字符串转 Long），仅用于诊断
 */

@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val listId: String?,
    val parentId: String?,
    val title: String,
    val notes: String?,
    val priority: Int,
    val status: Int,
    val completedAt: String?,
    val dueDate: String?,
    val isAllDay: Boolean,
    val startDate: String?,
    val timezone: String?,
    val recurrenceRule: String?,
    val recurrenceTz: String?,
    val recurrenceDtstart: String?,
    val recurrenceEnd: String?,
    val repeatFrom: Int,
    val nextDueDate: String?,
    val reminders: List<ReminderDto>?,
    val reminderRepeatMinutes: Int?,
    val checklist: List<ChecklistItemDto>?,
    val sortOrder: Long,
    val tagIds: List<String>,
    val updatedAt: String,
    val seq: Long,
    val dirty: Boolean,
    val deletedPending: Boolean,
)

@Entity(tableName = "lists")
data class ListEntity(
    @PrimaryKey val id: String,
    val folderId: String?,
    val name: String,
    val color: Int?,
    val icon: String?,
    val isInbox: Boolean,
    val isArchived: Boolean,
    val sortOrder: Long,
    val updatedAt: String,
    val seq: Long,
    val dirty: Boolean,
    val deletedPending: Boolean,
)

@Entity(tableName = "folders")
data class FolderEntity(
    @PrimaryKey val id: String,
    val name: String,
    val color: Int?,
    val sortOrder: Long,
    val updatedAt: String,
    val seq: Long,
    val dirty: Boolean,
    val deletedPending: Boolean,
)

@Entity(tableName = "tags")
data class TagEntity(
    @PrimaryKey val id: String,
    val name: String,
    val color: Int?,
    val sortOrder: Long,
    val updatedAt: String,
    val seq: Long,
    val dirty: Boolean,
    val deletedPending: Boolean,
)

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey val id: String,
    val name: String,
    val icon: String?,
    val color: Int?,
    val goalType: Int,
    val targetValue: Int?,
    val unit: String?,
    val frequency: Int,
    val weekDays: List<Int>,
    val repeatRule: String?,
    val startDate: String?,
    val reminders: List<ReminderDto>?,
    val archived: Boolean,
    val sortOrder: Long,
    val updatedAt: String,
    val seq: Long,
    val dirty: Boolean,
    val deletedPending: Boolean,
)

@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val userId: String,
    val theme: String?,
    val weekStart: Int?,
    val dayStartHour: Int?,
    val dateFormat: String?,
    val modulePomodoro: Boolean?,
    val moduleHabits: Boolean?,
    val moduleMatrix: Boolean?,
    val moduleCalendar: Boolean?,
    val smartListsVisible: List<String>?,
    val defaultListId: String?,
    val defaultPriority: Int?,
    val defaultReminderOffset: Int?,
    val focusSettingsJson: String?,
    val updatedAt: String,
    val seq: Long,
    val dirty: Boolean,
)

@Entity(tableName = "tombstones", primaryKeys = ["type", "id"])
data class TombstoneEntity(
    val type: String,
    val id: String,
)

/**
 * 聚合提醒调度表：每个「未完成 + 有到期日 + 有 reminders」的任务一行，
 * 记录其下一次提醒的绝对时刻（epoch millis）与通知文案。
 */
@Entity(tableName = "scheduled_alarms")
data class ScheduledAlarmEntity(
    @PrimaryKey val taskId: String,
    val triggerAt: Long,
    val title: String,
    val subtitle: String?,
)

/** 子任务计数投影。 */
data class SubtaskCount(
    val parentId: String,
    val cnt: Int,
)
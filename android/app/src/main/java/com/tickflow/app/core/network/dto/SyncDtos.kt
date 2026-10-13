package com.tickflow.app.core.network.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * 同步相关 DTO。
 *
 * 注意契约：后端 BigInt 字段（seq / sortOrder）序列化为**字符串**，
 * 因此这里统一用 String 接收，落库前再由 mapper 转 Long。
 * 实体 JSON 即数据库字段（camelCase），响应会附带 userId/createdAt/deletedAt/lww* 等
 * 服务端字段，解码时由 Json { ignoreUnknownKeys = true } 忽略。
 */

@Serializable
data class FolderDto(
    val id: String,
    val name: String = "",
    val color: Int? = null,
    val sortOrder: String = "0",
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class ListDto(
    val id: String,
    val folderId: String? = null,
    val name: String = "",
    val color: Int? = null,
    val icon: String? = null,
    val isInbox: Boolean = false,
    val isArchived: Boolean = false,
    val sortOrder: String = "0",
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class TagDto(
    val id: String,
    val name: String = "",
    val color: Int? = null,
    val sortOrder: String = "0",
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class ReminderDto(val offset: Int = 0)

@Serializable
data class ChecklistItemDto(
    val id: String,
    val title: String = "",
    val checked: Boolean = false,
    val sortOrder: Int = 0,
)

@Serializable
data class TaskDto(
    val id: String,
    val listId: String? = null,
    val parentId: String? = null,
    val title: String = "",
    val notes: String? = null,
    val priority: Int = 0,
    val status: Int = 0,
    val completedAt: String? = null,
    val dueDate: String? = null,
    val isAllDay: Boolean = false,
    val startDate: String? = null,
    val timezone: String? = null,
    val recurrenceRule: String? = null,
    val recurrenceTz: String? = null,
    val recurrenceDtstart: String? = null,
    val recurrenceEnd: String? = null,
    val repeatFrom: Int = 0,
    val nextDueDate: String? = null,
    val reminders: List<ReminderDto>? = null,
    val reminderRepeatMinutes: Int? = null,
    val checklist: List<ChecklistItemDto>? = null,
    val sortOrder: String = "0",
    val tagIds: List<String> = emptyList(),
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class HabitDto(
    val id: String,
    val name: String = "",
    val icon: String? = null,
    val color: Int? = null,
    val goalType: Int = 0,
    val targetValue: Int? = null,
    val unit: String? = null,
    val frequency: Int = 0,
    val weekDays: List<Int> = emptyList(),
    val repeatRule: String? = null,
    val startDate: String? = null,
    val reminders: List<ReminderDto>? = null,
    val archived: Boolean = false,
    val sortOrder: String = "0",
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class HabitRecordDto(
    val id: String,
    val habitId: String = "",
    val date: String = "",
    val value: Int = 1,
    val note: String? = null,
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class FocusSessionDto(
    val id: String,
    val taskId: String? = null,
    val mode: Int = 0,
    val plannedSeconds: Int = 0,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val actualSeconds: Int? = null,
    val breakSeconds: Int? = null,
    val pauseCount: Int = 0,
    val status: Int = 0,
    val interrupted: Boolean = false,
    val note: String? = null,
    val updatedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class SettingsDto(
    val theme: String? = null,
    val weekStart: Int? = null,
    val dayStartHour: Int? = null,
    val dateFormat: String? = null,
    val modulePomodoro: Boolean? = null,
    val moduleHabits: Boolean? = null,
    val moduleMatrix: Boolean? = null,
    val moduleCalendar: Boolean? = null,
    val smartListsVisible: List<String>? = null,
    val defaultListId: String? = null,
    val defaultPriority: Int? = null,
    val defaultReminderOffset: Int? = null,
    val focusSettings: JsonElement? = null,
    val updatedAt: String? = null,
    val seq: String? = null,
    val userId: String? = null,
)

/** 请求 / 响应共用的实体信封（空数组表示“无该表变更”）。 */
@Serializable
data class SyncEntityEnvelope(
    val folders: List<FolderDto> = emptyList(),
    val lists: List<ListDto> = emptyList(),
    val tags: List<TagDto> = emptyList(),
    val tasks: List<TaskDto> = emptyList(),
    val habits: List<HabitDto> = emptyList(),
    val habitRecords: List<HabitRecordDto> = emptyList(),
    val focusSessions: List<FocusSessionDto> = emptyList(),
    val settings: SettingsDto? = null,
)

@Serializable
data class TombstonePush(val type: String, val id: String)

@Serializable
data class SyncRequest(
    val deviceId: String,
    val cursor: Long = 0,
    val entities: SyncEntityEnvelope = SyncEntityEnvelope(),
    val tombstones: List<TombstonePush> = emptyList(),
)

@Serializable
data class TombstoneEntityDto(
    val id: String,
    val deletedAt: String? = null,
    val seq: String? = null,
)

@Serializable
data class SyncTombstoneEnvelope(
    val folders: List<TombstoneEntityDto> = emptyList(),
    val lists: List<TombstoneEntityDto> = emptyList(),
    val tags: List<TombstoneEntityDto> = emptyList(),
    val tasks: List<TombstoneEntityDto> = emptyList(),
    val habits: List<TombstoneEntityDto> = emptyList(),
    val habitRecords: List<TombstoneEntityDto> = emptyList(),
    val focusSessions: List<TombstoneEntityDto> = emptyList(),
    val settings: TombstoneEntityDto? = null,
)

@Serializable
data class AppliedDto(val type: String = "", val id: String = "", val seq: Long = 0)

@Serializable
data class SkippedDto(val type: String = "", val id: String = "")

@Serializable
data class SyncResponse(
    val cursor: Long = 0,
    val serverTime: String? = null,
    val clientLocalDate: String? = null,
    val entities: SyncEntityEnvelope = SyncEntityEnvelope(),
    val tombstones: SyncTombstoneEnvelope = SyncTombstoneEnvelope(),
    val applied: List<AppliedDto> = emptyList(),
    val skippedOlder: List<SkippedDto> = emptyList(),
    val needsFullResync: Boolean = false,
)

@Serializable
data class BootstrapResponse(
    val cursor: Long = 0,
    val entities: SyncEntityEnvelope = SyncEntityEnvelope(),
)
package com.tickflow.app.core.database

import com.tickflow.app.core.network.dto.FolderDto
import com.tickflow.app.core.network.dto.HabitDto
import com.tickflow.app.core.network.dto.ListDto
import com.tickflow.app.core.network.dto.SettingsDto
import com.tickflow.app.core.network.dto.TagDto
import com.tickflow.app.core.network.dto.TaskDto
import com.tickflow.app.core.util.TimeUtils
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
private fun String?.asLong(): Long = this?.toLongOrNull() ?: 0L
private fun String?.orNow(): String = if (isNullOrBlank()) TimeUtils.nowIso() else this

// ---------- 入站：DTO -> Entity ----------

fun FolderDto.toEntity(dirty: Boolean = false) = FolderEntity(
    id = id, name = name, color = color, sortOrder = sortOrder.asLong(),
    updatedAt = updatedAt.orNow(), seq = seq.asLong(), dirty = dirty, deletedPending = false,
)

fun ListDto.toEntity(dirty: Boolean = false) = ListEntity(
    id = id, folderId = folderId, name = name, color = color, icon = icon,
    isInbox = isInbox, isArchived = isArchived, sortOrder = sortOrder.asLong(),
    updatedAt = updatedAt.orNow(), seq = seq.asLong(), dirty = dirty, deletedPending = false,
)

fun TagDto.toEntity(dirty: Boolean = false) = TagEntity(
    id = id, name = name, color = color, sortOrder = sortOrder.asLong(),
    updatedAt = updatedAt.orNow(), seq = seq.asLong(), dirty = dirty, deletedPending = false,
)

fun TaskDto.toEntity(dirty: Boolean = false) = TaskEntity(
    id = id, listId = listId, parentId = parentId, title = title, notes = notes,
    priority = priority, status = status, completedAt = completedAt, dueDate = dueDate,
    isAllDay = isAllDay, startDate = startDate, timezone = timezone,
    recurrenceRule = recurrenceRule, recurrenceTz = recurrenceTz,
    recurrenceDtstart = recurrenceDtstart, recurrenceEnd = recurrenceEnd,
    repeatFrom = repeatFrom, nextDueDate = nextDueDate, reminders = reminders,
    reminderRepeatMinutes = reminderRepeatMinutes, checklist = checklist,
    sortOrder = sortOrder.asLong(), tagIds = tagIds,
    updatedAt = updatedAt.orNow(), seq = seq.asLong(), dirty = dirty, deletedPending = false,
)

fun HabitDto.toEntity(dirty: Boolean = false) = HabitEntity(
    id = id, name = name, icon = icon, color = color, goalType = goalType,
    targetValue = targetValue, unit = unit, frequency = frequency, weekDays = weekDays,
    repeatRule = repeatRule, startDate = startDate, reminders = reminders, archived = archived,
    sortOrder = sortOrder.asLong(), updatedAt = updatedAt.orNow(), seq = seq.asLong(),
    dirty = dirty, deletedPending = false,
)

fun SettingsDto.toEntity(userId: String, dirty: Boolean = false) = SettingsEntity(
    userId = userId, theme = theme, weekStart = weekStart, dayStartHour = dayStartHour,
    dateFormat = dateFormat, modulePomodoro = modulePomodoro, moduleHabits = moduleHabits,
    moduleMatrix = moduleMatrix, moduleCalendar = moduleCalendar,
    smartListsVisible = smartListsVisible, defaultListId = defaultListId,
    defaultPriority = defaultPriority, defaultReminderOffset = defaultReminderOffset,
    focusSettingsJson = focusSettings?.toString(), updatedAt = updatedAt.orNow(),
    seq = seq.asLong(), dirty = dirty,
)

// ---------- 出站：Entity -> DTO（仅携带客户端字段，seq 等留空） ----------

fun FolderEntity.toDto() = FolderDto(
    id = id, name = name, color = color, sortOrder = sortOrder.toString(), updatedAt = updatedAt,
)

fun ListEntity.toDto() = ListDto(
    id = id, folderId = folderId, name = name, color = color, icon = icon, isInbox = isInbox,
    isArchived = isArchived, sortOrder = sortOrder.toString(), updatedAt = updatedAt,
)

fun TagEntity.toDto() = TagDto(
    id = id, name = name, color = color, sortOrder = sortOrder.toString(), updatedAt = updatedAt,
)

fun TaskEntity.toDto() = TaskDto(
    id = id, listId = listId, parentId = parentId, title = title, notes = notes,
    priority = priority, status = status, completedAt = completedAt, dueDate = dueDate,
    isAllDay = isAllDay, startDate = startDate, timezone = timezone,
    recurrenceRule = recurrenceRule, recurrenceTz = recurrenceTz,
    recurrenceDtstart = recurrenceDtstart, recurrenceEnd = recurrenceEnd,
    repeatFrom = repeatFrom, nextDueDate = nextDueDate, reminders = reminders,
    reminderRepeatMinutes = reminderRepeatMinutes, checklist = checklist,
    sortOrder = sortOrder.toString(), tagIds = tagIds, updatedAt = updatedAt,
)

fun HabitEntity.toDto() = HabitDto(
    id = id, name = name, icon = icon, color = color, goalType = goalType,
    targetValue = targetValue, unit = unit, frequency = frequency, weekDays = weekDays,
    repeatRule = repeatRule, startDate = startDate, reminders = reminders, archived = archived,
    sortOrder = sortOrder.toString(), updatedAt = updatedAt,
)

fun SettingsEntity.toDto() = SettingsDto(
    theme = theme, weekStart = weekStart, dayStartHour = dayStartHour, dateFormat = dateFormat,
    modulePomodoro = modulePomodoro, moduleHabits = moduleHabits, moduleMatrix = moduleMatrix,
    moduleCalendar = moduleCalendar, smartListsVisible = smartListsVisible,
    defaultListId = defaultListId, defaultPriority = defaultPriority,
    defaultReminderOffset = defaultReminderOffset,
    focusSettings = focusSettingsJson?.let { runCatching { json.parseToJsonElement(it) }.getOrNull() },
    updatedAt = updatedAt,
)
package com.tickflow.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class OkResponse(val ok: Boolean = true)

/** GET /habits 返回习惯 + 近 30 天记录。 */
@Serializable
data class HabitWithRecordsDto(
    val id: String,
    val name: String = "",
    val icon: String? = null,
    val color: Int? = null,
    val goalType: Int = 0,
    val targetValue: Int = 1,
    val unit: String? = null,
    val frequency: Int = 0,
    val weekDays: List<Int> = emptyList(),
    val repeatRule: String? = null,
    val startDate: String? = null,
    val archived: Boolean = false,
    val sortOrder: String = "0",
    val updatedAt: String? = null,
    val records: List<HabitRecordDto> = emptyList(),
)

/** POST/PATCH /habits；null 字段在请求中被省略（PATCH 即局部更新）。 */
@Serializable
data class HabitUpsertRequest(
    val name: String? = null,
    val icon: String? = null,
    val color: Int? = null,
    val goalType: Int? = null,
    val targetValue: Int? = null,
    val unit: String? = null,
    val frequency: Int? = null,
    val weekDays: List<Int>? = null,
    val repeatRule: String? = null,
    val startDate: String? = null,
    val archived: Boolean? = null,
)

@Serializable
data class HabitCheckRequest(
    val date: String,
    val value: Int? = null,
)

@Serializable
data class FromTemplateRequest(val templateId: String)

@Serializable
data class HabitTemplateDto(
    val id: String,
    val title: String = "",
    val icon: String = "",
    val color: Int = 0,
    val category: String = "",
    val defaultGoalType: Int = 0,
    val defaultTargetValue: Int = 1,
    val defaultUnit: String? = null,
    val frequency: Int = 0,
    val sortOrder: Int = 0,
)

@Serializable
data class HabitStatDayDto(val date: String, val value: Int = 0)

@Serializable
data class HabitStatsDto(
    val habitId: String,
    val name: String = "",
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val completionRate: Double = 0.0,
    val days: List<HabitStatDayDto> = emptyList(),
)
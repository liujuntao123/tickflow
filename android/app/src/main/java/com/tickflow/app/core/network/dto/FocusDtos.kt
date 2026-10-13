package com.tickflow.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class FocusCreateRequest(
    val taskId: String? = null,
    val mode: Int = 0,
    val plannedSeconds: Int,
    val note: String? = null,
)

/** action: pause | resume | complete | cancel */
@Serializable
data class FocusPatchRequest(
    val action: String,
    val actualSeconds: Int? = null,
    val breakSeconds: Int? = null,
)

@Serializable
data class FocusByDayDto(
    val date: String,
    val totalSeconds: Int = 0,
    val count: Int = 0,
)

@Serializable
data class FocusStatsDto(
    val totalSeconds: Int = 0,
    val sessionCount: Int = 0,
    val byDay: List<FocusByDayDto> = emptyList(),
)
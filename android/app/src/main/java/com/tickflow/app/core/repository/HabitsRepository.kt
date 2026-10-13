package com.tickflow.app.core.repository

import com.tickflow.app.core.network.ApiErrorParser
import com.tickflow.app.core.network.TickFlowApi
import com.tickflow.app.core.network.dto.FromTemplateRequest
import com.tickflow.app.core.network.dto.HabitCheckRequest
import com.tickflow.app.core.network.dto.HabitStatsDto
import com.tickflow.app.core.network.dto.HabitTemplateDto
import com.tickflow.app.core.network.dto.HabitUpsertRequest
import com.tickflow.app.core.network.dto.HabitWithRecordsDto
import com.tickflow.app.core.util.TimeUtils
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HabitsRepository @Inject constructor(
    private val api: TickFlowApi,
    private val errorParser: ApiErrorParser,
) {
    suspend fun habits(): Result<List<HabitWithRecordsDto>> =
        runCatching { api.habits() }.mapApiError(errorParser)

    /** 统计（含连续天数与区间内每日值），用于热力图与连续天数展示。 */
    suspend fun stats(fromKey: String, toKey: String): Result<List<HabitStatsDto>> =
        runCatching { api.habitStats(TimeUtils.utcMidnightIso(fromKey), TimeUtils.utcMidnightIso(toKey)) }
            .mapApiError(errorParser)

    suspend fun templates(): Result<List<HabitTemplateDto>> =
        runCatching { api.habitTemplates() }.mapApiError(errorParser)

    suspend fun create(request: HabitUpsertRequest): Result<HabitWithRecordsDto> =
        runCatching { api.createHabit(request) }.mapApiError(errorParser)

    suspend fun update(id: String, request: HabitUpsertRequest): Result<HabitWithRecordsDto> =
        runCatching { api.updateHabit(id, request) }.mapApiError(errorParser)

    suspend fun delete(id: String): Result<Unit> =
        runCatching { api.deleteHabit(id) }.map { }.mapApiError(errorParser)

    suspend fun archive(id: String, archived: Boolean): Result<HabitWithRecordsDto> =
        runCatching { api.updateHabit(id, HabitUpsertRequest(archived = archived)) }.mapApiError(errorParser)

    suspend fun check(id: String, dateKey: String, value: Int? = null): Result<Unit> =
        runCatching { api.checkHabit(id, HabitCheckRequest(TimeUtils.utcMidnightIso(dateKey), value)) }
            .map { }.mapApiError(errorParser)

    suspend fun uncheck(id: String, dateKey: String): Result<Unit> =
        runCatching { api.uncheckHabit(id, HabitCheckRequest(TimeUtils.utcMidnightIso(dateKey))) }
            .map { }.mapApiError(errorParser)

    suspend fun fromTemplate(templateId: String): Result<HabitWithRecordsDto> =
        runCatching { api.habitFromTemplate(FromTemplateRequest(templateId)) }.mapApiError(errorParser)
}
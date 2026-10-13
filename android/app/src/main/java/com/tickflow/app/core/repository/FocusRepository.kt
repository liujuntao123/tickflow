package com.tickflow.app.core.repository

import com.tickflow.app.core.network.ApiErrorParser
import com.tickflow.app.core.network.TickFlowApi
import com.tickflow.app.core.network.dto.FocusCreateRequest
import com.tickflow.app.core.network.dto.FocusPatchRequest
import com.tickflow.app.core.network.dto.FocusSessionDto
import com.tickflow.app.core.network.dto.FocusStatsDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FocusRepository @Inject constructor(
    private val api: TickFlowApi,
    private val errorParser: ApiErrorParser,
) {
    suspend fun createSession(taskId: String?, plannedSeconds: Int): Result<FocusSessionDto> =
        runCatching { api.createFocusSession(FocusCreateRequest(taskId = taskId, plannedSeconds = plannedSeconds)) }
            .mapApiError(errorParser)

    suspend fun patch(
        id: String,
        action: String,
        actualSeconds: Int? = null,
        breakSeconds: Int? = null,
    ): Result<FocusSessionDto> =
        runCatching { api.patchFocusSession(id, FocusPatchRequest(action, actualSeconds, breakSeconds)) }
            .mapApiError(errorParser)

    suspend fun current(): Result<FocusSessionDto?> =
        runCatching { api.currentFocusSession() }.mapApiError(errorParser)

    /** from/to 为完整 ISO 时刻（服务端按 startedAt 区间过滤，故 to 需含今天全天）。 */
    suspend fun stats(fromIso: String, toIso: String): Result<FocusStatsDto> =
        runCatching { api.focusStats(fromIso, toIso) }
            .mapApiError(errorParser)
}
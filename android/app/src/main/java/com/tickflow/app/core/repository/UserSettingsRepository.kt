package com.tickflow.app.core.repository

import com.tickflow.app.core.network.ApiErrorParser
import com.tickflow.app.core.network.TickFlowApi
import com.tickflow.app.core.network.dto.FocusSettingsPayload
import com.tickflow.app.core.network.dto.SettingsDto
import com.tickflow.app.core.network.dto.SettingsUpdateRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

data class ModuleFlags(
    val pomodoro: Boolean = true,
    val habits: Boolean = true,
    val matrix: Boolean = true,
    val calendar: Boolean = true,
)

/**
 * 用户设置（REST 在线优先）：功能模块开关 + 番茄配置。
 * 供底部导航过滤与专注页配置读写；进入 App / 修改后刷新。
 */
@Singleton
class UserSettingsRepository @Inject constructor(
    private val api: TickFlowApi,
    private val errorParser: ApiErrorParser,
    private val json: Json,
) {
    private val _flags = MutableStateFlow(ModuleFlags())
    val flags: StateFlow<ModuleFlags> = _flags

    private val _focusSettings = MutableStateFlow(FocusSettingsPayload())
    val focusSettings: StateFlow<FocusSettingsPayload> = _focusSettings

    suspend fun refresh(): Result<Unit> = runCatching { applyDto(api.settings()) }.mapApiError(errorParser)

    suspend fun setModules(
        pomodoro: Boolean? = null,
        habits: Boolean? = null,
        matrix: Boolean? = null,
        calendar: Boolean? = null,
    ): Result<Unit> = runCatching {
        applyDto(
            api.updateSettings(
                SettingsUpdateRequest(
                    modulePomodoro = pomodoro,
                    moduleHabits = habits,
                    moduleMatrix = matrix,
                    moduleCalendar = calendar,
                )
            )
        )
    }.mapApiError(errorParser)

    suspend fun setFocusSettings(payload: FocusSettingsPayload): Result<Unit> = runCatching {
        applyDto(
            api.updateSettings(
                SettingsUpdateRequest(
                    focusSettings = json.encodeToJsonElement(FocusSettingsPayload.serializer(), payload),
                )
            )
        )
    }.mapApiError(errorParser)

    private fun applyDto(dto: SettingsDto) {
        _flags.value = ModuleFlags(
            pomodoro = dto.modulePomodoro ?: true,
            habits = dto.moduleHabits ?: true,
            matrix = dto.moduleMatrix ?: true,
            calendar = dto.moduleCalendar ?: true,
        )
        dto.focusSettings?.let { element ->
            runCatching {
                json.decodeFromJsonElement(FocusSettingsPayload.serializer(), element)
            }.getOrNull()?.let { _focusSettings.value = it }
        }
    }
}
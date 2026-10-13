package com.tickflow.app.core.network.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** PUT /settings 请求体；null 字段被省略，仅更新提供的项。 */
@Serializable
data class SettingsUpdateRequest(
    val theme: String? = null,
    val modulePomodoro: Boolean? = null,
    val moduleHabits: Boolean? = null,
    val moduleMatrix: Boolean? = null,
    val moduleCalendar: Boolean? = null,
    val focusSettings: JsonElement? = null,
)

/** focusSettings 自由 JSON 的结构（与 Web 端 `web/src/lib/focus-settings.ts` 对齐）。 */
@Serializable
data class FocusSettingsPayload(
    val focusMinutes: Int = 25,
    val shortBreakMinutes: Int = 5,
    val longBreakMinutes: Int = 15,
    val longBreakEvery: Int = 4,
    val autoStartNext: Boolean = true,
)
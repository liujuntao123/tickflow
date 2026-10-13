package com.tickflow.app.core.network

import com.tickflow.app.core.network.dto.BootstrapResponse
import com.tickflow.app.core.network.dto.FocusCreateRequest
import com.tickflow.app.core.network.dto.FocusPatchRequest
import com.tickflow.app.core.network.dto.FocusSessionDto
import com.tickflow.app.core.network.dto.FocusStatsDto
import com.tickflow.app.core.network.dto.FromTemplateRequest
import com.tickflow.app.core.network.dto.HabitCheckRequest
import com.tickflow.app.core.network.dto.HabitStatsDto
import com.tickflow.app.core.network.dto.HabitTemplateDto
import com.tickflow.app.core.network.dto.HabitUpsertRequest
import com.tickflow.app.core.network.dto.HabitWithRecordsDto
import com.tickflow.app.core.network.dto.LoginRequest
import com.tickflow.app.core.network.dto.LogoutResponse
import com.tickflow.app.core.network.dto.MeResponse
import com.tickflow.app.core.network.dto.OkResponse
import com.tickflow.app.core.network.dto.RefreshRequest
import com.tickflow.app.core.network.dto.RegisterRequest
import com.tickflow.app.core.network.dto.SessionResponse
import com.tickflow.app.core.network.dto.SettingsDto
import com.tickflow.app.core.network.dto.SettingsUpdateRequest
import com.tickflow.app.core.network.dto.SyncRequest
import com.tickflow.app.core.network.dto.SyncResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * 所有路径均相对 base（`{serverRoot}/api/v1/`），运行期由 BaseUrlInterceptor 动态改写 host。
 */
interface TickFlowApi {

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): SessionResponse

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): SessionResponse

    @POST("auth/logout")
    suspend fun logout(@Query("all") all: Boolean?): LogoutResponse

    @GET("auth/me")
    suspend fun me(): MeResponse

    @POST("sync")
    suspend fun sync(@Body body: SyncRequest): SyncResponse

    @GET("sync/bootstrap")
    suspend fun bootstrap(): BootstrapResponse

    // ---------------- habits ----------------

    @GET("habits")
    suspend fun habits(): List<HabitWithRecordsDto>

    @POST("habits")
    suspend fun createHabit(@Body body: HabitUpsertRequest): HabitWithRecordsDto

    @PATCH("habits/{id}")
    suspend fun updateHabit(@Path("id") id: String, @Body body: HabitUpsertRequest): HabitWithRecordsDto

    @DELETE("habits/{id}")
    suspend fun deleteHabit(@Path("id") id: String): OkResponse

    @POST("habits/{id}/check")
    suspend fun checkHabit(@Path("id") id: String, @Body body: HabitCheckRequest): OkResponse

    @POST("habits/{id}/uncheck")
    suspend fun uncheckHabit(@Path("id") id: String, @Body body: HabitCheckRequest): OkResponse

    @GET("habits/stats")
    suspend fun habitStats(@Query("from") from: String?, @Query("to") to: String?): List<HabitStatsDto>

    @GET("habit-templates")
    suspend fun habitTemplates(): List<HabitTemplateDto>

    @POST("habits/from-template")
    suspend fun habitFromTemplate(@Body body: FromTemplateRequest): HabitWithRecordsDto

    // ---------------- focus ----------------

    @POST("focus/sessions")
    suspend fun createFocusSession(@Body body: FocusCreateRequest): FocusSessionDto

    @PATCH("focus/sessions/{id}")
    suspend fun patchFocusSession(@Path("id") id: String, @Body body: FocusPatchRequest): FocusSessionDto

    @GET("focus/sessions/current")
    suspend fun currentFocusSession(): FocusSessionDto?

    @GET("focus/stats")
    suspend fun focusStats(
        @Query("from") from: String?,
        @Query("to") to: String?,
        @Query("granularity") granularity: String = "day",
    ): FocusStatsDto

    // ---------------- settings ----------------

    @GET("settings")
    suspend fun settings(): SettingsDto

    @PUT("settings")
    suspend fun updateSettings(@Body body: SettingsUpdateRequest): SettingsDto
}

/** 独立客户端，不带鉴权拦截器与 Authenticator，避免刷新时递归。 */
interface RefreshApi {
    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): SessionResponse
}
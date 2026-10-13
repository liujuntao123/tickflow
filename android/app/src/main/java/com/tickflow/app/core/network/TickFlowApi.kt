package com.tickflow.app.core.network

import com.tickflow.app.core.network.dto.BootstrapResponse
import com.tickflow.app.core.network.dto.LoginRequest
import com.tickflow.app.core.network.dto.LogoutResponse
import com.tickflow.app.core.network.dto.MeResponse
import com.tickflow.app.core.network.dto.RefreshRequest
import com.tickflow.app.core.network.dto.RegisterRequest
import com.tickflow.app.core.network.dto.SessionResponse
import com.tickflow.app.core.network.dto.SyncRequest
import com.tickflow.app.core.network.dto.SyncResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
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
}

/** 独立客户端，不带鉴权拦截器与 Authenticator，避免刷新时递归。 */
interface RefreshApi {
    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): SessionResponse
}
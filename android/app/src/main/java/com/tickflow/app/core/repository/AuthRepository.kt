package com.tickflow.app.core.repository

import com.tickflow.app.core.datastore.PreferencesStore
import com.tickflow.app.core.datastore.StoredUser
import com.tickflow.app.core.network.ApiErrorParser
import com.tickflow.app.core.network.RuntimeConfig
import com.tickflow.app.core.network.TickFlowApi
import com.tickflow.app.core.network.dto.LoginRequest
import com.tickflow.app.core.network.dto.RegisterRequest
import com.tickflow.app.core.sync.SyncScheduler
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

class ApiException(override val message: String) : Exception(message)

@Singleton
class AuthRepository @Inject constructor(
    private val api: TickFlowApi,
    private val prefs: PreferencesStore,
    private val config: RuntimeConfig,
    private val errorParser: ApiErrorParser,
    private val syncScheduler: SyncScheduler,
) {
    val loggedInFlow: Flow<Boolean> = prefs.loggedInFlow
    val serverUrlFlow: Flow<String> = prefs.serverUrlFlow

    /** 冷启动把 DataStore 载入运行期配置（供 OkHttp 拦截器使用）。 */
    suspend fun initRuntime() {
        config.serverRoot = prefs.serverUrl()
        config.accessToken = prefs.accessToken()
        config.refreshToken = prefs.refreshToken()
    }

    suspend fun isLoggedIn(): Boolean = prefs.accessToken() != null

    suspend fun currentUser(): StoredUser? = prefs.user()

    suspend fun serverUrl(): String = prefs.serverUrl()

    suspend fun setServerUrl(url: String) {
        val normalized = url.trim().trimEnd('/')
        prefs.setServerUrl(normalized)
        config.serverRoot = normalized
    }

    suspend fun login(email: String, password: String): Result<Unit> = runCatching {
        initRuntime()
        val deviceId = prefs.deviceId()
        val session = api.login(
            LoginRequest(email = email.trim(), password = password, deviceId = deviceId),
        )
        persist(session.user, session.accessToken, session.refreshToken)
    }.mapError()

    suspend fun register(email: String, password: String, displayName: String?): Result<Unit> = runCatching {
        initRuntime()
        val deviceId = prefs.deviceId()
        val session = api.register(
            RegisterRequest(
                email = email.trim(),
                password = password,
                displayName = displayName?.trim()?.takeIf { it.isNotBlank() },
                timezone = java.util.TimeZone.getDefault().id,
                deviceId = deviceId,
            ),
        )
        persist(session.user, session.accessToken, session.refreshToken)
    }.mapError()

    suspend fun logout(): Result<Unit> = runCatching {
        runCatching { api.logout(all = true) }
        prefs.clearSession()
        config.accessToken = null
        config.refreshToken = null
    }.mapError()

    private suspend fun persist(user: com.tickflow.app.core.network.dto.UserDto, access: String, refresh: String?) {
        prefs.saveSession(user, access, refresh)
        config.accessToken = access
        config.refreshToken = refresh
        syncScheduler.requestImmediate()
    }

    private fun Result<Unit>.mapError(): Result<Unit> = fold(
        onSuccess = { Result.success(Unit) },
        onFailure = { Result.failure(ApiException(errorParser.message(it))) },
    )
}
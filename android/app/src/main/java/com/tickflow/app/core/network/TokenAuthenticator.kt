package com.tickflow.app.core.network

import com.tickflow.app.core.datastore.PreferencesStore
import com.tickflow.app.core.network.dto.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

/**
 * access token 30min。遇到 401 时用 refreshToken 静默刷新（Android 平台 refreshToken 在响应 body 里）。
 * 刷新失败（含 REFRESH_REPLAY）则清空会话并放弃重试，上层 Flow 会切回登录页。
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val config: RuntimeConfig,
    private val refreshApi: RefreshApi,
    private val prefs: PreferencesStore,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // 已经重试过一次仍未成功，则放弃，避免死循环
        if (response.priorResponse != null) return null
        // 未携带鉴权头的请求（如登录/刷新）无需刷新
        if (response.request.header("Authorization") == null) return null

        val refreshToken = config.refreshToken ?: prefs.let { runBlocking { it.refreshToken() } } ?: return null

        val newAccess = runBlocking {
            try {
                val session = refreshApi.refresh(RefreshRequest(refreshToken))
                config.accessToken = session.accessToken
                session.refreshToken?.let { config.refreshToken = it }
                prefs.saveTokens(session.accessToken, session.refreshToken)
                session.accessToken
            } catch (e: Exception) {
                config.accessToken = null
                config.refreshToken = null
                prefs.clearSession()
                null
            }
        } ?: return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer $newAccess")
            .build()
    }
}
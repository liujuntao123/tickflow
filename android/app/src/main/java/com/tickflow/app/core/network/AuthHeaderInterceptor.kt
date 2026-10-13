package com.tickflow.app.core.network

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthHeaderInterceptor @Inject constructor(
    private val config: RuntimeConfig,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = config.accessToken
        val request = if (!token.isNullOrBlank()) {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
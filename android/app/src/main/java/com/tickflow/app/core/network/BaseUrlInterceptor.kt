package com.tickflow.app.core.network

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Retrofit 的 baseUrl 固定为占位 `http://localhost/api/v1/`，
 * 这里按运行期配置替换 scheme/host/port，实现服务器地址可配置。
 */
@Singleton
class BaseUrlInterceptor @Inject constructor(
    private val config: RuntimeConfig,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val root = config.serverRoot.trimEnd('/')
        val base = root.toHttpUrlOrNull()
        if (base == null) {
            return chain.proceed(request)
        }
        val newUrl = request.url.newBuilder()
            .scheme(base.scheme)
            .host(base.host)
            .port(base.port)
            .build()
        return chain.proceed(request.newBuilder().url(newUrl).build())
    }
}
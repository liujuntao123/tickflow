package com.tickflow.app.core.network

import javax.inject.Inject
import javax.inject.Singleton

/**
 * 运行期可变配置。OkHttp 拦截器在非协程上下文执行，无法直接读 DataStore，
 * 因此在 Application/登录等时机把值同步到这里的 volatile 字段。
 */
@Singleton
class RuntimeConfig @Inject constructor() {
    @Volatile var accessToken: String? = null
    @Volatile var refreshToken: String? = null

    /** 服务器根地址，例如 http://10.0.2.2:3000（不含 /api/v1）。 */
    @Volatile var serverRoot: String = DEFAULT_SERVER_ROOT

    companion object {
        /** 模拟器访问宿主机；真机用户改填电脑局域网 IP。 */
        const val DEFAULT_SERVER_ROOT = "http://10.0.2.2:3000"
        const val API_PATH = "/api/v1/"
    }
}
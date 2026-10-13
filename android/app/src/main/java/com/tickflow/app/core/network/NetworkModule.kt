package com.tickflow.app.core.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import com.tickflow.app.BuildConfig
import com.tickflow.app.core.network.dto.ApiErrorBody
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
        isLenient = true
        coerceInputValues = true
    }

    @Provides
    @Singleton
    fun provideLogging(): HttpLoggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        redactHeader("Authorization")
        redactHeader("Cookie")
    }

    @Provides
    @Singleton
    @Named("refresh")
    fun provideRefreshClient(
        baseUrlInterceptor: BaseUrlInterceptor,
        logging: HttpLoggingInterceptor,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(baseUrlInterceptor)
        .addInterceptor(logging)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideAuthClient(
        baseUrlInterceptor: BaseUrlInterceptor,
        authHeaderInterceptor: AuthHeaderInterceptor,
        tokenAuthenticator: TokenAuthenticator,
        logging: HttpLoggingInterceptor,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(baseUrlInterceptor)
        .addInterceptor(authHeaderInterceptor)
        .addInterceptor(logging)
        .authenticator(tokenAuthenticator)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    @Named("refresh")
    fun provideRefreshRetrofit(
        json: Json,
        @Named("refresh") client: OkHttpClient,
    ): Retrofit = Retrofit.Builder()
        .baseUrl("http://localhost${RuntimeConfig.API_PATH}")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(
        json: Json,
        client: OkHttpClient,
    ): Retrofit = Retrofit.Builder()
        .baseUrl("http://localhost${RuntimeConfig.API_PATH}")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideApi(retrofit: Retrofit): TickFlowApi = retrofit.create(TickFlowApi::class.java)

    @Provides
    @Singleton
    fun provideRefreshApi(@Named("refresh") retrofit: Retrofit): RefreshApi =
        retrofit.create(RefreshApi::class.java)

    @Provides
    @Singleton
    fun provideErrorParser(json: Json): ApiErrorParser = ApiErrorParser(json)
}

/** 把后端的统一错误结构翻译成中文提示。 */
@Singleton
class ApiErrorParser(private val json: Json) {

    fun message(throwable: Throwable): String = when (throwable) {
        is HttpException -> parseBody(throwable)
        is IOException -> "网络连接失败，请检查服务器地址与网络"
        else -> throwable.message ?: "未知错误"
    }

    private fun parseBody(e: HttpException): String {
        val raw = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
        if (!raw.isNullOrBlank()) {
            val parsed = runCatching { json.decodeFromString(ApiErrorBody.serializer(), raw) }.getOrNull()
            parsed?.error?.message?.let { return it }
            parsed?.error?.code?.let { return codeText(it) }
        }
        return codeText("HTTP_${e.code()}")
    }

    private fun codeText(code: String): String = when (code) {
        "VALIDATION_ERROR" -> "请求参数不合法"
        "AUTH_REQUIRED" -> "请先登录"
        "INVALID_TOKEN" -> "登录状态已失效"
        "INVALID_CREDENTIALS" -> "邮箱或密码不正确"
        "EMAIL_TAKEN" -> "该邮箱已注册"
        "REFRESH_REPLAY" -> "登录状态已失效，请重新登录"
        "RATE_LIMITED" -> "操作过于频繁，请稍后再试"
        "NOT_FOUND" -> "资源不存在"
        "CONFLICT" -> "操作冲突"
        else -> code
    }
}
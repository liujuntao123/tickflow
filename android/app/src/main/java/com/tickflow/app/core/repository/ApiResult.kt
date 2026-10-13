package com.tickflow.app.core.repository

import com.tickflow.app.core.network.ApiErrorParser

/** 把网络/HTTP 异常统一翻译为带中文提示的 [ApiException]。 */
internal fun <T> Result<T>.mapApiError(parser: ApiErrorParser): Result<T> = fold(
    onSuccess = { Result.success(it) },
    onFailure = { Result.failure(ApiException(parser.message(it))) },
)
package com.tickflow.app.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    val deviceId: String,
    val platform: String = "android",
    val appVersion: String? = null,
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String? = null,
    val timezone: String? = null,
    val deviceId: String,
    val platform: String = "android",
    val appVersion: String? = null,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val displayName: String = "",
    val timezone: String = "Asia/Shanghai",
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val lastLoginAt: String? = null,
)

@Serializable
data class SessionResponse(
    val user: UserDto,
    val accessToken: String,
    val refreshToken: String? = null,
)

@Serializable
data class LogoutResponse(val ok: Boolean = true)

@Serializable
data class DeviceDto(
    val deviceId: String,
    val platform: String? = null,
    val appVersion: String? = null,
    val lastSyncAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class MeResponse(
    val user: UserDto,
    val sessionId: String? = null,
    val devices: List<DeviceDto> = emptyList(),
)

@Serializable
data class ApiError(val code: String? = null, val message: String? = null)

@Serializable
data class ApiErrorBody(val error: ApiError? = null)
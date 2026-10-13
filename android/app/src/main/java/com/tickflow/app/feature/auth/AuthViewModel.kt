package com.tickflow.app.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.network.RuntimeConfig
import com.tickflow.app.core.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    var email by mutableStateOf("")
        private set
    var password by mutableStateOf("")
        private set
    var displayName by mutableStateOf("")
        private set
    var serverUrl by mutableStateOf(RuntimeConfig.DEFAULT_SERVER_ROOT)
        private set
    var isRegister by mutableStateOf(false)
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch { serverUrl = authRepository.serverUrl() }
    }

    fun onEmailChange(value: String) { email = value; error = null }
    fun onPasswordChange(value: String) { password = value; error = null }
    fun onDisplayNameChange(value: String) { displayName = value; error = null }
    fun onServerUrlChange(value: String) { serverUrl = value; error = null }
    fun toggleMode() { isRegister = !isRegister; error = null }

    fun submit() {
        if (loading) return
        val trimmedEmail = email.trim()
        if (trimmedEmail.isBlank() || !trimmedEmail.contains("@")) {
            error = "请输入有效邮箱"; return
        }
        if (password.length < (if (isRegister) 8 else 1)) {
            error = if (isRegister) "密码至少 8 位" else "请输入密码"; return
        }
        if (serverUrl.isBlank()) {
            error = "请填写服务器地址"; return
        }
        viewModelScope.launch {
            loading = true
            error = null
            authRepository.setServerUrl(serverUrl)
            val result = if (isRegister) {
                authRepository.register(trimmedEmail, password, displayName)
            } else {
                authRepository.login(trimmedEmail, password)
            }
            loading = false
            result.onFailure { error = it.message }
        }
    }
}
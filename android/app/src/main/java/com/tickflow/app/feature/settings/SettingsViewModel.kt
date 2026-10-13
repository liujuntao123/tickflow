package com.tickflow.app.feature.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.datastore.StoredUser
import com.tickflow.app.core.repository.AuthRepository
import com.tickflow.app.core.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val settingsRepository: SettingsRepository,
) : ViewModel() {

    private val scope = viewModelScope

    var serverUrl by mutableStateOf("")
        private set
    var user by mutableStateOf<StoredUser?>(null)
        private set
    var hint by mutableStateOf<String?>(null)
        private set

    val theme: StateFlow<String> =
        settingsRepository.themeFlow.stateIn(scope, SharingStarted.WhileSubscribed(5_000), "system")

    init {
        viewModelScope.launch {
            serverUrl = authRepository.serverUrl()
            user = authRepository.currentUser()
        }
    }

    fun onServerUrlChange(value: String) { serverUrl = value }

    fun saveServerUrl() {
        viewModelScope.launch {
            if (serverUrl.isBlank()) {
                hint = "请填写服务器地址"
                return@launch
            }
            authRepository.setServerUrl(serverUrl)
            serverUrl = authRepository.serverUrl()
            hint = "服务器地址已保存"
        }
    }

    fun setTheme(value: String) {
        viewModelScope.launch { settingsRepository.setTheme(value) }
    }

    fun logout() {
        viewModelScope.launch { authRepository.logout() }
    }

    fun consumeHint() { hint = null }
}
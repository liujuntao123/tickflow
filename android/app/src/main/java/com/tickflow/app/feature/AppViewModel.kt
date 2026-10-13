package com.tickflow.app.feature

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.repository.AuthRepository
import com.tickflow.app.core.repository.SettingsRepository
import com.tickflow.app.core.sync.SyncScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

data class AppUiState(val loggedIn: Boolean, val theme: String)

@HiltViewModel
class AppViewModel @Inject constructor(
    authRepository: AuthRepository,
    settingsRepository: SettingsRepository,
    private val syncScheduler: SyncScheduler,
) : ViewModel() {

    val uiState: StateFlow<AppUiState?> =
        combine(authRepository.loggedInFlow, settingsRepository.themeFlow) { loggedIn, theme ->
            AppUiState(loggedIn, theme)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun syncNow() = syncScheduler.requestImmediate()
}
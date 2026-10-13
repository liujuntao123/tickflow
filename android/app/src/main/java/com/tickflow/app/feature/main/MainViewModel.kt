package com.tickflow.app.feature.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.repository.ModuleFlags
import com.tickflow.app.core.repository.UserSettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val userSettingsRepository: UserSettingsRepository,
) : ViewModel() {

    val flags: StateFlow<ModuleFlags> =
        userSettingsRepository.flags.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ModuleFlags())

    init {
        viewModelScope.launch { userSettingsRepository.refresh() }
    }

    /** 被关闭模块的页面：回到任务页。 */
    fun isRouteEnabled(route: String, flags: ModuleFlags): Boolean = when (route) {
        Routes.FOCUS -> flags.pomodoro
        Routes.HABITS -> flags.habits
        Routes.CALENDAR -> flags.calendar
        Routes.MATRIX -> flags.matrix
        else -> true
    }
}
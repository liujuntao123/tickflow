package com.tickflow.app.feature.settings

import android.app.AlarmManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tickflow.app.core.datastore.StoredUser
import com.tickflow.app.core.reminder.ReminderScheduler
import com.tickflow.app.core.repository.AuthRepository
import com.tickflow.app.core.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val authRepository: AuthRepository,
    private val settingsRepository: SettingsRepository,
    private val reminderScheduler: ReminderScheduler,
) : ViewModel() {

    private val scope = viewModelScope

    var serverUrl by mutableStateOf("")
        private set
    var user by mutableStateOf<StoredUser?>(null)
        private set
    var hint by mutableStateOf<String?>(null)
        private set

    var notificationsEnabled by mutableStateOf(true)
        private set
    var exactAlarmAllowed by mutableStateOf(true)
        private set
    var ignoringBatteryOptimizations by mutableStateOf(false)
        private set

    val theme: StateFlow<String> =
        settingsRepository.themeFlow.stateIn(scope, SharingStarted.WhileSubscribed(5_000), "system")

    init {
        viewModelScope.launch {
            serverUrl = authRepository.serverUrl()
            user = authRepository.currentUser()
        }
        refreshSystemStatus()
    }

    fun refreshSystemStatus() {
        notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        exactAlarmAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(AlarmManager::class.java)?.canScheduleExactAlarms() ?: true
        } else {
            true
        }
        val power = context.getSystemService(PowerManager::class.java)
        ignoringBatteryOptimizations = power?.isIgnoringBatteryOptimizations(context.packageName) ?: false
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

    /** 权限变更后重算提醒（重新拿到精确闹钟权限即可恢复精确调度）。 */
    fun rescheduleReminders() {
        viewModelScope.launch { runCatching { reminderScheduler.rescheduleAll() } }
    }

    fun logout() {
        viewModelScope.launch { authRepository.logout() }
    }

    fun consumeHint() { hint = null }
}
package com.tickflow.app.core.repository

import com.tickflow.app.core.database.SettingsDao
import com.tickflow.app.core.database.SettingsEntity
import com.tickflow.app.core.datastore.PreferencesStore
import com.tickflow.app.core.sync.SyncScheduler
import com.tickflow.app.core.util.TimeUtils
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepository @Inject constructor(
    private val settingsDao: SettingsDao,
    private val prefs: PreferencesStore,
    private val syncScheduler: SyncScheduler,
) {
    val themeFlow: Flow<String> = prefs.themeFlow

    fun observeSettings(): Flow<SettingsEntity?> = settingsDao.observe()

    /** 主题同时落到 DataStore（即时驱动 UI）与 settings 实体（参与同步）。 */
    suspend fun setTheme(theme: String) {
        prefs.setTheme(theme)
        val userId = prefs.user()?.id ?: return
        val existing = settingsDao.get()
        val updated = (existing ?: emptySettings(userId)).copy(
            theme = theme,
            updatedAt = TimeUtils.nowIso(),
            dirty = true,
        )
        settingsDao.upsert(updated)
        val hasSession = prefs.accessToken() != null
        if (hasSession) syncScheduler.requestImmediate()
    }

    private fun emptySettings(userId: String) = SettingsEntity(
        userId = userId,
        theme = null,
        weekStart = null,
        dayStartHour = null,
        dateFormat = null,
        modulePomodoro = null,
        moduleHabits = null,
        moduleMatrix = null,
        moduleCalendar = null,
        smartListsVisible = null,
        defaultListId = null,
        defaultPriority = null,
        defaultReminderOffset = null,
        focusSettingsJson = null,
        updatedAt = TimeUtils.nowIso(),
        seq = 0,
        dirty = false,
    )
}
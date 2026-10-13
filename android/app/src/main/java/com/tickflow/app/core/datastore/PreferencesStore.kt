package com.tickflow.app.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.tickflow.app.core.network.RuntimeConfig
import com.tickflow.app.core.network.dto.UserDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "tickflow_prefs")

data class StoredUser(
    val id: String,
    val email: String,
    val displayName: String,
    val timezone: String,
)

@Singleton
class PreferencesStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val DEVICE_ID = stringPreferencesKey("device_id")
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val SERVER_URL = stringPreferencesKey("server_url")
        val CURSOR = longPreferencesKey("cursor")
        val THEME = stringPreferencesKey("theme")
        val USER_ID = stringPreferencesKey("user_id")
        val USER_EMAIL = stringPreferencesKey("user_email")
        val USER_NAME = stringPreferencesKey("user_name")
        val USER_TZ = stringPreferencesKey("user_tz")
        val LOGGED_IN = booleanPreferencesKey("logged_in")
        val NOTIF_ASKED = booleanPreferencesKey("notif_asked")
    }

    val themeFlow: Flow<String> = context.dataStore.data.map { it[Keys.THEME] ?: "system" }
    val loggedInFlow: Flow<Boolean> = context.dataStore.data.map { it[Keys.LOGGED_IN] == true }
    val serverUrlFlow: Flow<String> =
        context.dataStore.data.map { it[Keys.SERVER_URL] ?: RuntimeConfig.DEFAULT_SERVER_ROOT }

    suspend fun deviceId(): String {
        var id = ""
        context.dataStore.edit { prefs ->
            val existing = prefs[Keys.DEVICE_ID]
            if (existing.isNullOrBlank()) {
                id = "android-" + UUID.randomUUID().toString()
                prefs[Keys.DEVICE_ID] = id
            } else {
                id = existing
            }
        }
        return id
    }

    suspend fun accessToken(): String? = context.dataStore.data.first()[Keys.ACCESS_TOKEN]

    suspend fun refreshToken(): String? = context.dataStore.data.first()[Keys.REFRESH_TOKEN]

    suspend fun cursor(): Long = context.dataStore.data.first()[Keys.CURSOR] ?: 0L

    suspend fun setCursor(cursor: Long) {
        context.dataStore.edit { it[Keys.CURSOR] = cursor }
    }

    suspend fun serverUrl(): String =
        context.dataStore.data.first()[Keys.SERVER_URL] ?: RuntimeConfig.DEFAULT_SERVER_ROOT

    suspend fun setServerUrl(url: String) {
        context.dataStore.edit { it[Keys.SERVER_URL] = url }
    }

    suspend fun setTheme(theme: String) {
        context.dataStore.edit { it[Keys.THEME] = theme }
    }

    /** 通知运行时权限是否已引导过（仅首次启动引导一次）。 */
    suspend fun notifAskDone(): Boolean = context.dataStore.data.first()[Keys.NOTIF_ASKED] == true

    suspend fun markNotifAskDone() {
        context.dataStore.edit { it[Keys.NOTIF_ASKED] = true }
    }

    suspend fun saveSession(user: UserDto, accessToken: String, refreshToken: String?) {
        context.dataStore.edit { prefs ->
            prefs[Keys.ACCESS_TOKEN] = accessToken
            if (!refreshToken.isNullOrBlank()) prefs[Keys.REFRESH_TOKEN] = refreshToken
            prefs[Keys.USER_ID] = user.id
            prefs[Keys.USER_EMAIL] = user.email
            prefs[Keys.USER_NAME] = user.displayName
            prefs[Keys.USER_TZ] = user.timezone
            prefs[Keys.LOGGED_IN] = true
        }
    }

    suspend fun saveTokens(accessToken: String?, refreshToken: String?) {
        context.dataStore.edit { prefs ->
            if (accessToken != null) prefs[Keys.ACCESS_TOKEN] = accessToken
            if (refreshToken != null) prefs[Keys.REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun clearSession() {
        context.dataStore.edit { prefs ->
            prefs.remove(Keys.ACCESS_TOKEN)
            prefs.remove(Keys.REFRESH_TOKEN)
            prefs.remove(Keys.USER_ID)
            prefs.remove(Keys.USER_EMAIL)
            prefs.remove(Keys.USER_NAME)
            prefs.remove(Keys.USER_TZ)
            prefs[Keys.CURSOR] = 0L
            prefs[Keys.LOGGED_IN] = false
        }
    }

    suspend fun user(): StoredUser? {
        val p = context.dataStore.data.first()
        val id = p[Keys.USER_ID] ?: return null
        return StoredUser(
            id = id,
            email = p[Keys.USER_EMAIL] ?: "",
            displayName = p[Keys.USER_NAME] ?: "",
            timezone = p[Keys.USER_TZ] ?: "Asia/Shanghai",
        )
    }
}
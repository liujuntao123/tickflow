package com.tickflow.app.core.sync

import com.tickflow.app.core.database.FolderDao
import com.tickflow.app.core.database.HabitDao
import com.tickflow.app.core.database.ListDao
import com.tickflow.app.core.database.SettingsDao
import com.tickflow.app.core.database.TagDao
import com.tickflow.app.core.database.TaskDao
import com.tickflow.app.core.database.TombstoneEntity
import com.tickflow.app.core.database.toDto
import com.tickflow.app.core.database.toEntity
import com.tickflow.app.core.datastore.PreferencesStore
import com.tickflow.app.core.network.ApiErrorParser
import com.tickflow.app.core.network.RuntimeConfig
import com.tickflow.app.core.network.TickFlowApi
import com.tickflow.app.core.network.dto.SyncEntityEnvelope
import com.tickflow.app.core.network.dto.SyncRequest
import com.tickflow.app.core.network.dto.SyncTombstoneEnvelope
import com.tickflow.app.core.network.dto.TombstonePush
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

sealed interface SyncOutcome {
    data class Success(val cursor: Long, val pushed: Int, val pulled: Int, val fullResync: Boolean) : SyncOutcome
    data object NotLoggedIn : SyncOutcome
    data class Failure(val message: String) : SyncOutcome
}

/**
 * 状态基同步引擎（对齐 docs/api.md 的 POST /sync 语义）：
 * 1. 本地变更置 dirty，删除写 tombstones；
 * 2. 把 dirty 实体 + 墓碑打包上行（先推送后增量拉取，由服务端在同一事务完成）；
 * 3. 回包实体直接覆盖本地（LWW 以后端结果为准），但仍 dirty 的本地更新予以保留；
 * 4. needsFullResync=true 时清空非 dirty 缓存并走 GET /sync/bootstrap 全量重建。
 */
@Singleton
class SyncEngine @Inject constructor(
    private val api: TickFlowApi,
    private val prefs: PreferencesStore,
    private val config: RuntimeConfig,
    private val errorParser: ApiErrorParser,
    private val taskDao: TaskDao,
    private val listDao: ListDao,
    private val folderDao: FolderDao,
    private val tagDao: TagDao,
    private val habitDao: HabitDao,
    private val settingsDao: SettingsDao,
    private val tombstoneDao: com.tickflow.app.core.database.TombstoneDao,
) {
    private val mutex = Mutex()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing

    private val _lastMessage = MutableStateFlow<String?>(null)
    val lastMessage: StateFlow<String?> = _lastMessage

    suspend fun sync(): SyncOutcome = mutex.withLock {
        _isSyncing.value = true
        val outcome = try {
            runSync()
        } finally {
            _isSyncing.value = false
        }
        if (outcome is SyncOutcome.Failure) _lastMessage.value = outcome.message
        outcome
    }

    fun clearMessage() {
        _lastMessage.value = null
    }

    private suspend fun runSync(): SyncOutcome {
        val access = prefs.accessToken() ?: return SyncOutcome.NotLoggedIn
        config.accessToken = access
        config.refreshToken = prefs.refreshToken()
        config.serverRoot = prefs.serverUrl()

        return try {
            val deviceId = prefs.deviceId()
            val cursor = prefs.cursor()

            val dirtyTasks = taskDao.dirty()
            val dirtyLists = listDao.dirty()
            val dirtyFolders = folderDao.dirty()
            val dirtyTags = tagDao.dirty()
            val dirtyHabits = habitDao.dirty()
            val dirtySettings = settingsDao.dirty()
            val tombstones = tombstoneDao.all()

            val envelope = SyncEntityEnvelope(
                folders = dirtyFolders.map { it.toDto() },
                lists = dirtyLists.map { it.toDto() },
                tags = dirtyTags.map { it.toDto() },
                tasks = dirtyTasks.map { it.toDto() },
                habits = dirtyHabits.map { it.toDto() },
                settings = dirtySettings?.toDto(),
            )
            val pushedCount = dirtyTasks.size + dirtyLists.size + dirtyFolders.size +
                dirtyTags.size + dirtyHabits.size + (if (dirtySettings != null) 1 else 0) + tombstones.size

            val response = api.sync(
                SyncRequest(
                    deviceId = deviceId,
                    cursor = cursor,
                    entities = envelope,
                    tombstones = tombstones.map { TombstonePush(it.type, it.id) },
                )
            )

            if (response.needsFullResync) {
                // 服务端有数据且本地带增量：保留本地 dirty/墓碑，清空已确认缓存后全量重拉
                clearNonDirty()
                val bootstrap = api.bootstrap()
                applyEntities(bootstrap.entities)
                prefs.setCursor(bootstrap.cursor)
                return SyncOutcome.Success(bootstrap.cursor, 0, 0, fullResync = true)
            }

            // 清理已推送的 dirty（仅当自推送后未被再次修改）
            dirtyTasks.forEach { taskDao.clearDirtyIfUnchanged(it.id, it.updatedAt) }
            dirtyLists.forEach { listDao.clearDirtyIfUnchanged(it.id, it.updatedAt) }
            dirtyFolders.forEach { folderDao.clearDirtyIfUnchanged(it.id, it.updatedAt) }
            dirtyTags.forEach { tagDao.clearDirtyIfUnchanged(it.id, it.updatedAt) }
            dirtyHabits.forEach { habitDao.clearDirtyIfUnchanged(it.id, it.updatedAt) }
            dirtySettings?.let { settingsDao.clearDirtyIfUnchanged(it.userId, it.updatedAt) }

            // 清理已上行墓碑与本地待删行
            if (tombstones.isNotEmpty()) {
                tombstoneDao.deleteByIds(tombstones.map { it.id })
                taskDao.deletePending()
                listDao.deletePending()
                folderDao.deletePending()
                tagDao.deletePending()
                habitDao.deletePending()
            }

            // 应用服务端回包
            val pulled = applyEntities(response.entities)
            applyTombstones(response.tombstones)

            prefs.setCursor(response.cursor)
            SyncOutcome.Success(response.cursor, pushedCount, pulled, fullResync = false)
        } catch (e: Exception) {
            SyncOutcome.Failure(errorParser.message(e))
        }
    }

    private suspend fun clearNonDirty() {
        taskDao.deleteNonDirty()
        listDao.deleteNonDirty()
        folderDao.deleteNonDirty()
        tagDao.deleteNonDirty()
        habitDao.deleteNonDirty()
        settingsDao.deleteNonDirty()
    }

    /** 覆盖式应用回包实体；本地仍 dirty 的行跳过，保留未上行的本地更新。 */
    private suspend fun applyEntities(entities: SyncEntityEnvelope): Int {
        var count = 0

        if (entities.folders.isNotEmpty()) {
            val dirtyIds = folderDao.dirty().map { it.id }.toSet()
            val rows = entities.folders.filter { it.id !in dirtyIds }.map { it.toEntity(false) }
            folderDao.upsertAll(rows)
            count += rows.size
        }
        if (entities.lists.isNotEmpty()) {
            val dirtyIds = listDao.dirty().map { it.id }.toSet()
            val rows = entities.lists.filter { it.id !in dirtyIds }.map { it.toEntity(false) }
            listDao.upsertAll(rows)
            count += rows.size
        }
        if (entities.tags.isNotEmpty()) {
            val dirtyIds = tagDao.dirty().map { it.id }.toSet()
            val rows = entities.tags.filter { it.id !in dirtyIds }.map { it.toEntity(false) }
            tagDao.upsertAll(rows)
            count += rows.size
        }
        if (entities.tasks.isNotEmpty()) {
            val dirtyIds = taskDao.dirty().map { it.id }.toSet()
            val rows = entities.tasks.filter { it.id !in dirtyIds }.map { it.toEntity(false) }
            taskDao.upsertAll(rows)
            count += rows.size
        }
        if (entities.habits.isNotEmpty()) {
            val dirtyIds = habitDao.dirty().map { it.id }.toSet()
            val rows = entities.habits.filter { it.id !in dirtyIds }.map { it.toEntity(false) }
            habitDao.upsertAll(rows)
            count += rows.size
        }

        entities.settings?.let { dto ->
            val local = settingsDao.get()
            if (local?.dirty != true) {
                val userId = dto.userId ?: prefs.user()?.id
                if (userId != null) {
                    settingsDao.upsert(dto.toEntity(userId, dirty = false))
                    count += 1
                }
            }
            // 服务端主题回落到 DataStore，驱动界面主题
            dto.theme?.let { if (it.isNotBlank()) prefs.setTheme(it) }
        }
        return count
    }

    private suspend fun applyTombstones(tombstones: SyncTombstoneEnvelope) {
        tombstones.folders.forEach { folderDao.deleteIfNotDirty(it.id) }
        tombstones.lists.forEach { listDao.deleteIfNotDirty(it.id) }
        tombstones.tags.forEach { tagDao.deleteIfNotDirty(it.id) }
        tombstones.tasks.forEach { taskDao.deleteIfNotDirty(it.id) }
        tombstones.habits.forEach { habitDao.deleteIfNotDirty(it.id) }
    }

    /** 供本地写入后登记墓碑。 */
    suspend fun addTombstone(type: String, id: String) {
        tombstoneDao.insert(TombstoneEntity(type, id))
    }
}